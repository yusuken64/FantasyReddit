const { Int } = require('mssql');
const { pool, poolConnect, sql } = require('./database')
const { COOLDOWN_MINUTES } = require('./module/priceUpdater');

async function canBuy(userId, symbol) {
  await poolConnect;

  const request = new sql.Request(pool);
  request.input('userId', sql.Int, userId);
  request.input('symbol', sql.NVarChar(10), symbol);

  const query = `
    SELECT 
      COUNT(*) AS holdingCount,
      MAX(CASE WHEN stock_symbol = @symbol THEN 1 ELSE 0 END) AS alreadyOwned
    FROM holdings
    WHERE user_id = @userId
  `;

  const result = await request.query(query);
  const { holdingCount, alreadyOwned } = result.recordset[0];

  // User can buy if they own < 20 holdings OR already own the symbol
  return holdingCount < 20 || alreadyOwned === 1;
}

async function buy(userId, symbol, quantity, price, scores) {
  const totalCost = price * quantity;
  await poolConnect;

  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    let request = new sql.Request(transaction);

    // Check user credits
    const userResult = await request
      .input('userId', sql.Int, userId)
      .query('SELECT credits FROM users WHERE id = @userId');

    const user = userResult.recordset[0];
    if (!user) throw new Error('User not found');
    if (user.credits < totalCost) throw new Error('Insufficient credits');

    // Deduct credits
    request = new sql.Request(transaction);
    await request
      .input('totalCost', sql.Int, totalCost)
      .input('userId', sql.Int, userId)
      .query('UPDATE users SET credits = credits - @totalCost WHERE id = @userId');

    // Get current holdings entry
    request = new sql.Request(transaction);
    const holdingsResult = await request
      .input('userId', sql.Int, userId)
      .input('symbol', sql.NVarChar(10), symbol)
      .query('SELECT shares, total_spent FROM holdings WHERE user_id = @userId AND stock_symbol = @symbol');

    const holding = holdingsResult.recordset[0];

    if (!holding) {
      // Insert new holding row
      request = new sql.Request(transaction);
      await request
        .input('userId', sql.Int, userId)
        .input('symbol', sql.NVarChar(10), symbol)
        .input('shares', sql.Int, quantity)
        .input('totalSpent', sql.Int, totalCost)
        .query(`INSERT INTO holdings (user_id, stock_symbol, shares, total_spent)
                VALUES (@userId, @symbol, @shares, @totalSpent)`);

      //insert into price history
      const checkStaleQuery = `
        SELECT 1
        FROM stock_price_history
        WHERE stock_symbol = @symbol
        AND timestamp >= DATEADD(minute, -@cooldown, SYSUTCDATETIME())
      `;

      request = new sql.Request(transaction);
      request.input('symbol', sql.NVarChar(10), symbol);
      request.input('cooldown', sql.Int, COOLDOWN_MINUTES);
      const { recordset } = await request.query(checkStaleQuery);

      const isFresh = recordset.length > 0;

      if (!isFresh) {
        // safe to insert new price snapshot
        const now = new Date().toISOString();

        request = new sql.Request(transaction);
        await request
          .input('symbol', sql.NVarChar(10), symbol)
          .input('timestamp', sql.DateTime2, now)
          .input('score', sql.BigInt, price)
          .input('price', sql.BigInt, price)
          .query(`
            INSERT INTO stock_price_history (stock_symbol, timestamp, score, price)
            VALUES (@symbol, @timestamp, @score, @price)
          `);
      }

    } else {
      // Update existing holding row
      const newShares = holding.shares + quantity;
      const newTotalSpent = holding.total_spent + totalCost;

      request = new sql.Request(transaction);
      await request
        .input('newShares', sql.Int, newShares)
        .input('newTotalSpent', sql.Int, newTotalSpent)
        .input('userId', sql.Int, userId)
        .input('symbol', sql.NVarChar(10), symbol)
        .query(`UPDATE holdings SET shares = @newShares, total_spent = @newTotalSpent
                WHERE user_id = @userId AND stock_symbol = @symbol`);
    }

    // Insert transaction log
    request = new sql.Request(transaction);
    await request
      .input('userId', sql.Int, userId)
      .input('symbol', sql.NVarChar(10), symbol)
      .input('action', sql.NVarChar(4), 'BUY')
      .input('shares', sql.Int, quantity)
      .input('pricePerShare', sql.Decimal(18, 2), price)
      .input('totalCost', sql.Decimal(18, 2), totalCost)
      .query(`
        INSERT INTO transactions (user_id, stock_symbol, action, shares, price_per_share, total_cost)
        VALUES (@userId, @symbol, @action, @shares, @pricePerShare, @totalCost)
      `)

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

async function sell(userId, symbol, quantity, price) {
  await poolConnect;
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    let request = new sql.Request(transaction);

    // Get holding entry
    const holdingResult = await request
      .input('userId', sql.Int, userId)
      .input('symbol', sql.NVarChar(10), symbol)
      .query('SELECT shares, total_spent FROM holdings WHERE user_id = @userId AND stock_symbol = @symbol');

    const holding = holdingResult.recordset[0];
    if (!holding || holding.shares < quantity) throw new Error('Not enough shares to sell');

    const averageCost = holding.total_spent / holding.shares;
    const totalProceeds = price * quantity;

    const newShares = holding.shares - quantity;
    const newTotalSpent = holding.total_spent - averageCost * quantity;

    // Update holding shares and total_spent
    request = new sql.Request(transaction);
    await request
      .input('newShares', sql.Int, newShares)
      .input('newTotalSpent', sql.Int, newTotalSpent)
      .input('userId', sql.Int, userId)
      .input('symbol', sql.NVarChar(10), symbol)
      .query(`UPDATE holdings SET shares = @newShares, total_spent = @newTotalSpent
              WHERE user_id = @userId AND stock_symbol = @symbol`);

    // Add credits to user
    request = new sql.Request(transaction);
    await request
      .input('totalProceeds', sql.Int, totalProceeds)
      .input('userId', sql.Int, userId)
      .query('UPDATE users SET credits = credits + @totalProceeds WHERE id = @userId');

    // Insert transaction log
    request = new sql.Request(transaction);
    await request
      .input('userId', sql.Int, userId)
      .input('symbol', sql.NVarChar(10), symbol)
      .input('action', sql.NVarChar(4), 'SELL')
      .input('shares', sql.Int, quantity)
      .input('pricePerShare', sql.Decimal(18, 2), price)
      .input('totalCost', sql.Decimal(18, 2), totalProceeds)
      .query(`
        INSERT INTO transactions (user_id, stock_symbol, action, shares, price_per_share, total_cost)
        VALUES (@userId, @symbol, @action, @shares, @pricePerShare, @totalCost)
      `)

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

module.exports = { buy, sell, canBuy }
