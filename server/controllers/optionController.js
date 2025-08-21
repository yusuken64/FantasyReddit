const database = require('../database');
const optionSettlement = require('../workers/optionSettlement');

/**
 * Get all active options for the logged-in user
 */
async function getMyOptions(req, res) {
  try {
    const result = await database.pool.request()
      .input('userId', database.sql.BigInt, req.user.id)
      .query(`
        SELECT *
        FROM options
        WHERE user_id = @userId
        ORDER BY expires_at ASC
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
    const { stockSymbol, optionType, strikePrice, premiumPaid, quantity, expiresAt } = req.body;

    const pool = database.pool;
    const tx = new database.sql.Transaction(pool);
    await tx.begin();
    try {
      const request = tx.request();
      await request
        .input('userId', database.sql.BigInt, req.user.id)
        .input('stockSymbol', database.sql.NVarChar(10), stockSymbol)
        .input('optionType', database.sql.NVarChar(4), optionType)
        .input('strikePrice', database.sql.BigInt, strikePrice)
        .input('premiumPaid', database.sql.BigInt, premiumPaid)
        .input('quantity', database.sql.BigInt, quantity)
        .input('expiresAt', database.sql.DateTime2, expiresAt)
        .query(`
          INSERT INTO options
            (user_id, stock_symbol, option_type, strike_price, premium_paid, quantity, expires_at)
          VALUES (@userId, @stockSymbol, @optionType, @strikePrice, @premiumPaid, @quantity, @expiresAt)
        `);

      // Deduct credits from user
      await request.query(`
        UPDATE users
        SET credits = credits - @premiumPaid
        WHERE id = @userId
      `);

      await tx.commit();

      // Reschedule the option settlement timer if this expires earlier than current
      optionSettlement.maybeReschedule(new Date(expiresAt));

      res.json({ success: true });
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to buy option' });
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
    await optionSettlement.exerciseOptions([optionId]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to exercise option' });
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

module.exports = {
  getMyOptions,
  getOptionById,
  buyOption,
  exerciseOption,
  getOptionHistory
};
