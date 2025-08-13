// const { pool, sql, poolConnect } = require('../database');
const database = require('../database');

async function calculatePrice(post) {
  const basePrice = 10;
  const scoreWeight = 5;

  await database.poolConnect;
  const request = database.pool.request();
  request.input('stock_symbol', database.sql.NVarChar(10), post.id);

  const result = await request.query(`
    SELECT TOP 1 score, timestamp, price
    FROM stock_price_history
    WHERE stock_symbol = @stock_symbol
    ORDER BY timestamp DESC
  `);

  const now = new Date();

  let previous;
  let isNew = false;

  if (result.recordset.length > 0) {
    previous = result.recordset[0];
  } else {
    // Simulate a previous record at post creation time
    const postCreatedTime = post.created_utc
      ? new Date(post.created_utc * 1000)
      : now;

    previous = {
      score: 1,
      timestamp: postCreatedTime.toISOString(),
      price: basePrice
    };

    isNew = true;
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

  // Insert into DB if it's a new post
  if (isNew) {
    const insertRequest = database.pool.request();
    insertRequest.input('stock_symbol', database.sql.NVarChar(10), post.id);
    insertRequest.input('score', database.sql.Int, post.score);
    insertRequest.input('price', database.sql.Money, finalPrice);

    await insertRequest.query(`
      INSERT INTO stock_price_history (stock_symbol, score, timestamp, price)
      VALUES (@stock_symbol, @score, GETUTCDATE(), @price)
    `);
  }

  return finalPrice;
}

module.exports = { calculatePrice };