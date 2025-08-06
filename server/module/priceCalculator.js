const { pool, sql, poolConnect } = require('../database');

async function calculatePrice(post) {
  const basePrice = 10;
  const scoreWeight = 5;

  // Get the previous snapshot from DB
  await poolConnect;
  const request = pool.request();
  request.input('stock_symbol', sql.NVarChar(10), post.id);

  const result = await request.query(`
    SELECT TOP 1 score, timestamp, price
    FROM stock_price_history
    WHERE stock_symbol = @stock_symbol
    ORDER BY timestamp DESC
  `);

  let previous = null;
  if (result.recordset.length > 0) {
    previous = result.recordset[0];
  }

  // Prepare previous values or defaults
  const now = new Date();
  const prevScore = previous ? previous.score : 0;
  const prevTime = previous ? new Date(previous.timestamp) : now;

  const minutesElapsed = (now - prevTime) / 60000;
  if (minutesElapsed <= 0) return previous?.price ?? basePrice;

  const scoreChange = post.score - prevScore;
  const scoreRate = scoreChange / minutesElapsed;

  // Age decay factor
  const postCreatedTime = post.created_utc
    ? new Date(post.created_utc * 1000)
    : now;
  const postAgeHours = Math.max(1, (now - postCreatedTime) / 3600000);
  const ageDecay = 1 / Math.log(postAgeHours + 2);

  // Calculate final price
  const rawPrice =
    basePrice + (scoreRate * scoreWeight) * ageDecay;

  const finalPrice = Math.max(basePrice, Math.round(rawPrice));

  return finalPrice;
}

module.exports = { calculatePrice };