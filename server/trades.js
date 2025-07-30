const { pool, poolConnect, sql } = require('./database')

async function buy(userId, symbol, quantity, price) {
  const totalCost = price * quantity;
  await poolConnect;

  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    // Use a new request per query
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

    // Get current portfolio entry
    request = new sql.Request(transaction);
    const portfolioResult = await request
      .input('userId', sql.Int, userId)
      .input('symbol', sql.NVarChar(10), symbol)
      .query('SELECT shares, total_spent FROM portfolios WHERE user_id = @userId AND stock_symbol = @symbol');

    const portfolio = portfolioResult.recordset[0];

    if (!portfolio) {
      // Insert new portfolio row
      request = new sql.Request(transaction);
      await request
        .input('userId', sql.Int, userId)
        .input('symbol', sql.NVarChar(10), symbol)
        .input('shares', sql.Int, quantity)
        .input('totalSpent', sql.Int, totalCost)
        .query(`INSERT INTO portfolios (user_id, stock_symbol, shares, total_spent)
                VALUES (@userId, @symbol, @shares, @totalSpent)`);
    } else {
      // Update existing portfolio row
      const newShares = portfolio.shares + quantity;
      const newTotalSpent = portfolio.total_spent + totalCost;

      request = new sql.Request(transaction);
      await request
        .input('newShares', sql.Int, newShares)
        .input('newTotalSpent', sql.Int, newTotalSpent)
        .input('userId', sql.Int, userId)
        .input('symbol', sql.NVarChar(10), symbol)
        .query(`UPDATE portfolios SET shares = @newShares, total_spent = @newTotalSpent
                WHERE user_id = @userId AND stock_symbol = @symbol`);
    }

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

    // Get portfolio entry
    const portfolioResult = await request
      .input('userId', sql.Int, userId)
      .input('symbol', sql.NVarChar(10), symbol)
      .query('SELECT shares, total_spent FROM portfolios WHERE user_id = @userId AND stock_symbol = @symbol');

    const portfolio = portfolioResult.recordset[0];
    if (!portfolio || portfolio.shares < quantity) throw new Error('Not enough shares to sell');

    const averageCost = portfolio.total_spent / portfolio.shares;
    const totalProceeds = price * quantity;

    const newShares = portfolio.shares - quantity;
    const newTotalSpent = portfolio.total_spent - averageCost * quantity;

    // Update portfolio shares and total_spent
    request = new sql.Request(transaction);
    await request
      .input('newShares', sql.Int, newShares)
      .input('newTotalSpent', sql.Int, newTotalSpent)
      .input('userId', sql.Int, userId)
      .input('symbol', sql.NVarChar(10), symbol)
      .query(`UPDATE portfolios SET shares = @newShares, total_spent = @newTotalSpent
              WHERE user_id = @userId AND stock_symbol = @symbol`);

    // Add credits to user
    request = new sql.Request(transaction);
    await request
      .input('totalProceeds', sql.Int, totalProceeds)
      .input('userId', sql.Int, userId)
      .query('UPDATE users SET credits = credits + @totalProceeds WHERE id = @userId');

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

module.exports = { buy, sell }
