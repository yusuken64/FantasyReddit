require('mssql');
const database = require('./database');
const { readQuote } = require('./module/priceCalculator');

async function canBuy(userId, symbol) {  
  await database.poolConnect;

  const request = new database.sql.Request(database.pool);
  request.input('userId', database.sql.BigInt, userId);
  request.input('symbol', database.sql.NVarChar(10), symbol);

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

async function buy(userId, symbol, quantity, quoteId) {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error('Invalid quantity');
  let price;
  let totalCost;
  await database.poolConnect;

  const transaction = new database.sql.Transaction(database.pool);
  try {
    await transaction.begin();
    price = (await readQuote(symbol, transaction, quoteId ?? null)).price;

    let request = new database.sql.Request(transaction);

    totalCost = price * quantity;
    if (!Number.isSafeInteger(totalCost)) throw new Error('Order too large');

    // Check user credits
    const userResult = await request
      .input('userId', database.sql.BigInt, userId)
      .query('SELECT credits FROM users WITH (UPDLOCK, HOLDLOCK) WHERE id = @userId');

    const user = userResult.recordset[0];
    if (!user) throw new Error('User not found');
    if (user.credits < totalCost) throw new Error('Insufficient credits');

    // Deduct credits
    request = new database.sql.Request(transaction);
    await request
      .input('totalCost', database.sql.BigInt, totalCost)
      .input('userId', database.sql.BigInt, userId)
      .query('UPDATE users SET credits = credits - @totalCost WHERE id = @userId');

    // Get current holdings entry
    request = new database.sql.Request(transaction);
    const holdingsResult = await request
      .input('userId', database.sql.BigInt, userId)
      .input('symbol', database.sql.NVarChar(10), symbol)
      .query('SELECT shares, total_spent FROM holdings WITH (UPDLOCK, HOLDLOCK) WHERE user_id = @userId AND stock_symbol = @symbol');

    const holding = holdingsResult.recordset[0];

    if (!holding) {
      // Insert new holding row
      request = new database.sql.Request(transaction);
      await request
        .input('userId', database.sql.BigInt, userId)
        .input('symbol', database.sql.NVarChar(10), symbol)
        .input('shares', database.sql.BigInt, quantity)
        .input('totalSpent', database.sql.BigInt, totalCost)
        .query(`INSERT INTO holdings (user_id, stock_symbol, shares, total_spent)
                VALUES (@userId, @symbol, @shares, @totalSpent)`);


    } else {
      // Update existing holding row
      const newShares = Number(holding.shares) + quantity;
      const newTotalSpent = Number(holding.total_spent) + totalCost;

      request = new database.sql.Request(transaction);
      await request
        .input('newShares', database.sql.BigInt, newShares)
        .input('newTotalSpent', database.sql.BigInt, newTotalSpent)
        .input('userId', database.sql.BigInt, userId)
        .input('symbol', database.sql.NVarChar(10), symbol)
        .query(`UPDATE holdings SET shares = @newShares, total_spent = @newTotalSpent
                WHERE user_id = @userId AND stock_symbol = @symbol`);
    }

    // Insert transaction log
    request = new database.sql.Request(transaction);
    await request
      .input('userId', database.sql.BigInt, userId)
      .input('symbol', database.sql.NVarChar(10), symbol)
      .input('action', database.sql.NVarChar(4), 'BUY')
      .input('shares', database.sql.BigInt, quantity)
      .input('pricePerShare', database.sql.Decimal(18, 2), price)
      .input('totalCost', database.sql.Decimal(18, 2), totalCost)
      .query(`
        INSERT INTO transactions (user_id, stock_symbol, action, shares, price_per_share, total_cost)
        VALUES (@userId, @symbol, @action, @shares, @pricePerShare, @totalCost)
      `)

    await transaction.commit();
    return price;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

async function sell(userId, symbol, quantity, quoteId) {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error('Invalid quantity');
  let price;
  await database.poolConnect;
  const transaction = new database.sql.Transaction(database.pool);

  try {
    await transaction.begin();
    price = (await readQuote(symbol, transaction, quoteId ?? null)).price;

    let request = new database.sql.Request(transaction);

    // Get holding entry
    const holdingResult = await request
      .input('userId', database.sql.BigInt, userId)
      .input('symbol', database.sql.NVarChar(10), symbol)
      .query('SELECT shares, total_spent FROM holdings WITH (UPDLOCK, HOLDLOCK) WHERE user_id = @userId AND stock_symbol = @symbol');

    const holding = holdingResult.recordset[0];
    if (!holding || holding.shares < quantity) throw new Error('Not enough shares to sell');

    const averageCost = holding.total_spent / holding.shares;
    const totalProceeds = price * quantity;

    const newShares = holding.shares - quantity;
    const newTotalSpent = holding.total_spent - averageCost * quantity;

    // Update holding shares and total_spent
    request = new database.sql.Request(transaction);
    await request
      .input('newShares', database.sql.BigInt, newShares)
      .input('newTotalSpent', database.sql.BigInt, newTotalSpent)
      .input('userId', database.sql.BigInt, userId)
      .input('symbol', database.sql.NVarChar(10), symbol)
      .query(`UPDATE holdings SET shares = @newShares, total_spent = @newTotalSpent
              WHERE user_id = @userId AND stock_symbol = @symbol`);

    // Add credits to user
    request = new database.sql.Request(transaction);
    await request
      .input('totalProceeds', database.sql.BigInt, totalProceeds)
      .input('userId', database.sql.BigInt, userId)
      .query('UPDATE users SET credits = credits + @totalProceeds WHERE id = @userId');

    // Insert transaction log
    request = new database.sql.Request(transaction);
    await request
      .input('userId', database.sql.BigInt, userId)
      .input('symbol', database.sql.NVarChar(10), symbol)
      .input('action', database.sql.NVarChar(4), 'SELL')
      .input('shares', database.sql.BigInt, quantity)
      .input('pricePerShare', database.sql.Decimal(18, 2), price)
      .input('totalCost', database.sql.Decimal(18, 2), totalProceeds)
      .query(`
        INSERT INTO transactions (user_id, stock_symbol, action, shares, price_per_share, total_cost)
        VALUES (@userId, @symbol, @action, @shares, @pricePerShare, @totalCost)
      `)

    await transaction.commit();
    return price;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

module.exports = { buy, sell, canBuy }
