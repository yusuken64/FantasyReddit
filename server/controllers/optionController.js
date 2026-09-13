const database = require('../database');
const optionSettlement = require('../module/optionSettlement');
const { readQuote } = require('../module/priceCalculator');
const { fetchPostWithPrice, getAuthenticatedUser } = require('./redditController');

/**
 * Get all active options for the logged-in user
 */
async function getMyOptions(req, res) {
  try {
    const { sortBy = 'expires_at', sortDir = 'ASC', limit = 10, offset = 0 } = req.query;

    // validate inputs (important to avoid SQL injection)
    const validSortFields = ['expires_at', 'created_at', 'id']; 
    const validSortDir = ['ASC', 'DESC'];

    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'expires_at';
    const safeSortDir = validSortDir.includes(sortDir.toUpperCase()) ? sortDir.toUpperCase() : 'ASC';

    const result = await database.pool.request()
      .input('userId', database.sql.BigInt, req.user.id)
      .input('limit', database.sql.Int, limit)
      .input('offset', database.sql.Int, offset)
      .query(`
        SELECT *
        FROM options
        WHERE user_id = @userId
        ORDER BY ${safeSortBy} ${safeSortDir}
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch options' });
  }
}

/**
 * Get a single active option by ID
 */
async function getOptionById(req, res) {
  try {
    const result = await database.pool.request()
      .input('userId', database.sql.BigInt, req.user.id)
      .input('optionId', database.sql.BigInt, req.params.optionId)
      .query(`
        SELECT *
        FROM options
        WHERE id = @optionId AND user_id = @userId
      `);

    if (!result.recordset.length) {
      return res.status(404).json({ error: 'Option not found' });
    }

    res.json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch option' });
  }
}

/**
 * Buy a new option
 */
async function buyOption(req, res) {
  try {
    const { stockSymbol, strikePrice, quantity, expiresAt, quoteId } = req.body;
    const optionType = String(req.body.optionType).toUpperCase();
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || !['CALL', 'PUT'].includes(optionType)) {
      return res.status(400).json({ error: 'Invalid option order' });
    }
    const user = await getAuthenticatedUser(req);
    const data = await fetchPostWithPrice(`https://oauth.reddit.com/by_id/t3_${stockSymbol}.json`, user, true);
    const post = data?.data?.children?.[0]?.data;
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const pool = database.pool;
    const tx = new database.sql.Transaction(pool);
    await tx.begin();
    try {
      const quote = await readQuote(stockSymbol, tx, quoteId ?? null);
      const contract = generateOptionChain({ ...post, price: quote.price, quote })
        .find(c => c.type.toUpperCase() === optionType && c.strike === strikePrice && c.expiration.toISOString() === expiresAt);
      if (!contract || contract.premium !== req.body.premiumPaid) {
        const error = new Error('Option quote changed. Refresh the options and confirm again.');
        error.status = 409;
        throw error;
      }
      const premiumPaid = contract.premium * quantity * 100;
      if (!Number.isSafeInteger(premiumPaid)) throw new Error('Order too large');
      const balance = await tx.request().input('userId', database.sql.BigInt, req.user.id)
        .input('cost', database.sql.BigInt, premiumPaid)
        .query('UPDATE users SET credits = credits - @cost WHERE id = @userId AND credits >= @cost');
      if (balance.rowsAffected[0] !== 1) throw new Error('Insufficient credits');
      const request = tx.request();
      await request
        .input('userId', database.sql.BigInt, req.user.id)
        .input('stockSymbol', database.sql.NVarChar(10), stockSymbol)
        .input('optionType', database.sql.NVarChar(4), optionType)
        .input('strikePrice', database.sql.BigInt, strikePrice)
        .input('premiumPaid', database.sql.BigInt, premiumPaid)
        .input('quantity', database.sql.BigInt, quantity * 100)
        .input('expiresAt', database.sql.DateTime2, expiresAt)
        .query(`
          INSERT INTO options
            (user_id, stock_symbol, option_type, strike_price, premium_paid, quantity, expires_at)
          VALUES (@userId, @stockSymbol, @optionType, @strikePrice, @premiumPaid, @quantity, @expiresAt)
        `);

      await tx.commit();

      // Reschedule the option settlement timer if this expires earlier than current
      optionSettlement.maybeReschedule(new Date(expiresAt));

      res.json({ success: true, price: strikePrice });
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to buy option' });
  }
}

/**
 * Exercise an option early
 */
async function exerciseOption(req, res) {
  try {
    const optionId = parseInt(req.params.optionId, 10);
    if (isNaN(optionId)) return res.status(400).json({ error: 'Invalid option ID' });

    // Trigger early exercise using the worker module
    const owned = await database.pool.request().input('id', database.sql.BigInt, optionId)
      .input('userId', database.sql.BigInt, req.user.id)
      .query('SELECT id FROM options WHERE id = @id AND user_id = @userId');
    if (!owned.recordset.length) return res.status(404).json({ error: 'Option not found' });
    await optionSettlement.exerciseOptions([optionId]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to exercise option' });
  }
}

/**
 * Get option transaction history for the logged-in user
 */
async function getOptionHistory(req, res) {
  try {
    const result = await database.pool.request()
      .input('userId', database.sql.BigInt, req.user.id)
      .query(`
        SELECT *
        FROM option_transactions
        WHERE user_id = @userId
        ORDER BY timestamp DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch option history' });
  }
}

function generateOptionChain(post) {
  const { id: postId, price, quote } = post;
  const quotedAt = new Date(quote.id);

  const expirations = [1, 3, 7, 30].map(days => {
    const d = new Date(quotedAt);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
  });

  const strikeSteps = [0.9, 0.95, 1, 1.05, 1.1];

  const baseVolatility = Math.min(0.5, 0.1 + (quote.score ?? 0) / 100); // 10%-50%

  const contracts = [];

  expirations.forEach(exp => {
    strikeSteps.forEach(mult => {
      const strike = Math.round(price * mult);
      const timeToExpiry = (exp - quotedAt) / (1000 * 60 * 60 * 24 * 365);
      
      // Premium = intrinsic + extrinsic
      const callIntrinsic = Math.max(0, price - strike);
      const putIntrinsic = Math.max(0, strike - price);
      const callPremium = Math.ceil(callIntrinsic + baseVolatility * Math.sqrt(timeToExpiry) * price);
      const putPremium = Math.ceil(putIntrinsic + baseVolatility * Math.sqrt(timeToExpiry) * price);

      contracts.push({ type: "call", strike, expiration: exp, premium: callPremium, postId });
      contracts.push({ type: "put", strike, expiration: exp, premium: putPremium, postId });
    });
  });

  return contracts;
}

/**
 * GET /options/chain/:postId
 */
async function getOptionChain(req, res) {
  try {
    const { symbol } = req.params;
    if (!symbol) return res.status(400).json({ error: "Invalid post ID" });

    // Fetch current post info
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const data = await fetchPostWithPrice(`https://oauth.reddit.com/by_id/t3_${symbol}.json`, user, true);
    const post = (await data)?.data?.children?.[0]?.data;
    if (!post) return res.status(404).json({ error: 'Post not found' });

    if (post.quote.status !== 'ready') return res.status(409).json({ error: 'Price data is collecting or stale. Refresh after the next update.' });
    const contracts = generateOptionChain(post);

    res.json({
      postId: post.id,
      price: post.price,
      quoteId: post.quote.id,
      contracts
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate option chain" });
  }
}

module.exports = {
  getMyOptions,
  getOptionById,
  buyOption,
  exerciseOption,
  getOptionHistory,
  getOptionChain
};
