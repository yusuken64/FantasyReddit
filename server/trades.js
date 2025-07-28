const db = require('./database');

const buy = db.transaction((userId, symbol, quantity, price) => {
  const totalCost = price * quantity;

  const user = db.prepare('SELECT credits FROM users WHERE id = ?').get(userId);
  if (!user) throw new Error('User not found');
  if (user.credits < totalCost) throw new Error('Insufficient credits');

  db.prepare('UPDATE users SET credits = credits - ? WHERE id = ?')
    .run(totalCost, userId);

  const portfolio = db.prepare(`
    SELECT shares, total_spent FROM portfolios WHERE user_id = ? AND stock_symbol = ?
  `).get(userId, symbol);

  if (!portfolio) {
    // Insert new row with shares and total_spent
    db.prepare(`
      INSERT INTO portfolios (user_id, stock_symbol, shares, total_spent)
      VALUES (?, ?, ?, ?)
    `).run(userId, symbol, quantity, totalCost);
  } else {
    // Update existing row: add shares and total_spent
    const newShares = portfolio.shares + quantity;
    const newTotalSpent = portfolio.total_spent + totalCost;

    db.prepare(`
      UPDATE portfolios SET shares = ?, total_spent = ? WHERE user_id = ? AND stock_symbol = ?
    `).run(newShares, newTotalSpent, userId, symbol);
  }
});

const sell = db.transaction((userId, symbol, quantity, price) => {
  const portfolio = db.prepare(`
    SELECT shares, total_spent FROM portfolios WHERE user_id = ? AND stock_symbol = ?
  `).get(userId, symbol);

  if (!portfolio || portfolio.shares < quantity) throw new Error('Not enough shares to sell');

  const averageCost = portfolio.total_spent / portfolio.shares;
  const totalProceeds = price * quantity;

  const newShares = portfolio.shares - quantity;
  const newTotalSpent = portfolio.total_spent - averageCost * quantity;

  // Update portfolio shares and total_spent
  db.prepare(`
    UPDATE portfolios SET shares = ?, total_spent = ? WHERE user_id = ? AND stock_symbol = ?
  `).run(newShares, newTotalSpent, userId, symbol);

  // Add credits to user
  db.prepare(`
    UPDATE users SET credits = credits + ? WHERE id = ?
  `).run(totalProceeds, userId);
});

module.exports = { buy, sell };
