const database = require('../database');
const { fetchPostWithPrice, getAuthenticatedUserById } = require('../controllers/redditController');
const { calculatePrice } = require('./priceCalculator');

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
    const user = await getAuthenticatedUserById(option.user_id);
    if (!user) continue;

    let currentPrice = option.strike_price;
    try {
      const data = await fetchPostWithPrice(
        `https://oauth.reddit.com/by_id/t3_${option.stock_symbol}.json`,
        user,
        true
      );
      const post = data?.data?.children?.[0]?.data;
      if (post) {
        try {
          currentPrice = await calculatePrice(post);
        } catch {
          currentPrice = option.strike_price;
        }
      }
    } catch {
      currentPrice = option.strike_price;
    }

    let payout = 0;
    if (option.option_type === 'CALL') {
      payout = Math.max(0, currentPrice - option.strike_price) * option.quantity;
    } else if (option.option_type === 'PUT') {
      payout = Math.max(0, option.strike_price - currentPrice) * option.quantity;
    }

    processed.push({ option, payout });
  }

  // Step 3: apply updates in one short transaction
  const tx = new database.sql.Transaction(pool);
  await tx.begin();
  try {
    for (const { option, payout } of processed) {
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
        .input('action', database.sql.NVarChar(10), onlyExpired ? 'EXPIRE' : 'EXERCISE')
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
    console.error('Option processing failed during commit:', err);
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

  const waitMs = Math.max(0, expiryTime.getTime() - Date.now());
  nextExpiry = expiryTime;

  currentTimer = setTimeout(async () => {
    await processExpiredOptions();
    await findAndScheduleNext();
  }, waitMs);
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
  startOptionSettlementWorker,
  maybeReschedule,
  exerciseOptions
};
