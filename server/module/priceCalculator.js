const { pool, sql, poolConnect } = require('../database');

async function calculatePrice(post) {
  const basePrice = 10;
  const scoreWeight = 5;

  await poolConnect;
  const request = pool.request();
  request.input('stock_symbol', sql.NVarChar(10), post.id);

  const result = await request.query(`
    SELECT TOP 1 score, timestamp, price
    FROM stock_price_history
    WHERE stock_symbol = @stock_symbol
    ORDER BY timestamp DESC
  `);

  const now = new Date();

  let previous = null;
  if (result.recordset.length > 0) {
    previous = result.recordset[0];
  } else {
    // First-time snapshot: seed the score to avoid a jump next time
    const seedRequest = pool.request();
    seedRequest.input('stock_symbol', sql.NVarChar(10), post.id);
    seedRequest.input('score', sql.Int, post.score);
    seedRequest.input('price', sql.Money, basePrice);

    await seedRequest.query(`
      INSERT INTO stock_price_history (stock_symbol, score, timestamp, price)
      VALUES (@stock_symbol, @score, GETUTCDATE(), @price)
    `);

    return basePrice;
  }

  const prevScore = previous.score;
  const prevTime = new Date(previous.timestamp);

  const minutesElapsed = (now - prevTime) / 60000;
  if (minutesElapsed <= 0) return previous.price;

  const scoreChange = post.score - prevScore;
  const scoreRate = scoreChange / minutesElapsed;

  // Age decay
  const postCreatedTime = post.created_utc
    ? new Date(post.created_utc * 1000)
    : now;
  const postAgeHours = Math.max(1, (now - postCreatedTime) / 3600000);
  const ageDecay = 1 / Math.log(postAgeHours + 2);

  const rawPrice = basePrice + (scoreRate * scoreWeight * ageDecay);
  const finalPrice = Math.max(basePrice, Math.round(rawPrice));

  return finalPrice;
}

module.exports = { calculatePrice };