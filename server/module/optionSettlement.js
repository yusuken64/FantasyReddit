const database = require('../database');
const { readQuote } = require('./priceCalculator');

let nextExpiry = null;
let currentTimer = null;

// Start the worker loop
function startOptionSettlementWorker() {
  findAndScheduleNext();
}
/**
 * Process all options that have expired (auto-settlement)
 */
async function processExpiredOptions() {
  await processOptions({ onlyExpired: true });
}

/**
 * Process option(s), either expired or early exercise
 * @param {Object} opts
 *   onlyExpired: boolean - process only expired options
 *   optionIds: array of option IDs for early exercise
 */
async function processOptions({ onlyExpired = false, optionIds = [] } = {}) {
  const pool = database.pool;

  // Step 1: query options without transaction
  let query = '';
  if (onlyExpired) {
    query = `SELECT * FROM options WHERE expires_at <= SYSUTCDATETIME()`;
  } else if (optionIds.length > 0) {
    query = `SELECT * FROM options WHERE id IN (${optionIds.join(',')})`;
  } else {
    throw new Error('No options to process');
  }

  const result = await pool.request().query(query);
  const processed = [];

  // Step 2: compute payouts (no DB writes yet)
  for (const option of result.recordset) {
    let currentPrice;
    let quoteId;
    const expired = onlyExpired || new Date(option.expires_at).getTime() <= Date.now();
    if (expired) {
      // Use the last fresh published quote at expiry, or the first subsequent quote after an outage.
      const history = await pool.request()
        .input('symbol', database.sql.NVarChar(10), option.stock_symbol)
        .input('expiry', database.sql.DateTime2, option.expires_at)
        .query(`SELECT TOP 1 price FROM stock_price_history
          WHERE stock_symbol = @symbol AND pricing_model = 'momentum-v1'
            AND timestamp > DATEADD(minute, -10, @expiry)
          ORDER BY CASE WHEN timestamp <= @expiry THEN 0 ELSE 1 END,
            CASE WHEN timestamp <= @expiry THEN timestamp END DESC,
            CASE WHEN timestamp > @expiry THEN timestamp END ASC`);
      if (!history.recordset.length) continue;
      currentPrice = Number(history.recordset[0].price);
    } else {
      const quote = await readQuote(option.stock_symbol);
      if (quote.status !== 'ready') {
        const error = new Error('Quote unavailable. Refresh and try again after the next update.');
        error.status = 409;
        throw error;
      }
      currentPrice = quote.price;
      quoteId = quote.id;
    }

    let payout = 0;
    if (option.option_type === 'CALL') {
      payout = Math.max(0, currentPrice - option.strike_price) * option.quantity;
    } else if (option.option_type === 'PUT') {
      payout = Math.max(0, option.strike_price - currentPrice) * option.quantity;
    }

    processed.push({ option, payout, quoteId, expired });
  }

  // Step 3: apply updates in one short transaction
  const tx = new database.sql.Transaction(pool);
  await tx.begin();
  try {
    for (const { option, payout, quoteId, expired } of processed) {
      const existing = await tx.request().input('optionId', database.sql.BigInt, option.id)
        .query('SELECT id FROM options WITH (UPDLOCK, HOLDLOCK) WHERE id = @optionId');
      if (!existing.recordset.length) continue;
      if (quoteId) await readQuote(option.stock_symbol, tx, quoteId);
      await tx.request()
        .input('payout', database.sql.BigInt, payout)
        .input('userId', database.sql.BigInt, option.user_id)
        .query(`UPDATE users SET credits = credits + @payout WHERE id = @userId`);

      await tx.request()
        .input('userId', database.sql.BigInt, option.user_id)
        .input('symbol', database.sql.NVarChar(10), option.stock_symbol)
        .input('type', database.sql.NVarChar(4), option.option_type)
        .input('strike', database.sql.BigInt, option.strike_price)
        .input('premium', database.sql.BigInt, option.premium_paid)
        .input('quantity', database.sql.BigInt, option.quantity)
        .input('payout', database.sql.BigInt, payout)
        .input('action', database.sql.NVarChar(10), expired ? 'EXPIRE' : 'EXERCISE')
        .query(`
          INSERT INTO option_transactions
            (user_id, stock_symbol, option_type, strike_price, premium_paid, quantity, payout, action)
          VALUES (@userId, @symbol, @type, @strike, @premium, @quantity, @payout, @action)
        `);

      await tx.request()
        .input('id', database.sql.BigInt, option.id)
        .query(`DELETE FROM options WHERE id = @id`);
    }
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

// Find the next option expiry and schedule a timer
async function findAndScheduleNext() {
  const pool = database.pool;
  const request = pool.request();

  const result = await request.query(`
    SELECT TOP 1 expires_at
    FROM options
    ORDER BY expires_at ASC
  `);

  if (result.recordset.length === 0) {
    nextExpiry = null;
    currentTimer = null;
    return;
  }

  const expiryTime = new Date(result.recordset[0].expires_at);
  scheduleNextExpiry(expiryTime);
}

// Schedule the next timer
function scheduleNextExpiry(expiryTime) {
  if (currentTimer) clearTimeout(currentTimer);

  const waitMs = Math.max(60000, expiryTime.getTime() - Date.now());
  nextExpiry = expiryTime;

  currentTimer = setTimeout(async () => {
    try { await processExpiredOptions(); }
    catch (error) { console.error('Option settlement failed:', error.message); }
    finally { await findAndScheduleNext(); }
  }, waitMs);
  currentTimer.unref();
}

// Call this after creating a new option to reschedule if it's earlier than current
function maybeReschedule(newOptionExpiry) {
  if (!newOptionExpiry) {
    findAndScheduleNext()
  } else if (!nextExpiry || newOptionExpiry < nextExpiry) {
    scheduleNextExpiry(newOptionExpiry);
  }
}

/**
 * Trigger early exercise for specific options
 * @param {Array<number>} optionIds
 */
async function exerciseOptions(optionIds) {
  if (!Array.isArray(optionIds) || optionIds.length === 0) return;
  await processOptions({ onlyExpired: false, optionIds });
}

module.exports = {
  processExpiredOptions,
  startOptionSettlementWorker,
  maybeReschedule,
  exerciseOptions
};
