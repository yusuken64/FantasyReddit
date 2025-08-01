// priceUpdater.js
const { pool, sql, poolConnect } = require('../database');
const axios = require('axios');

const cron = require('node-cron');

const COOLDOWN_MINUTES = 5;

function startPriceUpdateCron() {
  cron.schedule('*/5 * * * *', async () => {
    console.log('Running price update cron job...');
    try {
      await updateAllTrackedStockPrices();
    } catch (err) {
      console.error('Price update cron job failed:', err);
    }
  });
}

// Main update function
async function updateAllTrackedStockPrices() {
  const startTime = Date.now();
  console.log('Price update job started at', new Date(startTime).toISOString());

  const users = await getAllUsersWithPortfolios();

  for (const user of users) {
    try {
      const stalePostIds = await getStalePostIdsForUser(user.id);
      if (stalePostIds.length === 0) continue;

      // Reddit posts require fullnames starting with "t3_" prefix
      const postFullnames = stalePostIds.map(id =>
        id.startsWith('t3_') ? id : `t3_${id}`
      );

      const posts = await fetchPostsFromReddit(postFullnames, user.access_token);
      if (posts.length === 0) continue;

      await insertStockPriceHistories(user.id, posts);
    } catch (err) {
      console.error(`Error updating prices for user ${user.id}:`, err);
    }
  }

  const endTime = Date.now();
  console.log('Price update job finished at', new Date(endTime).toISOString());

  const elapsedSeconds = ((endTime - startTime) / 1000).toFixed(2);
  console.log(`Price update job took ${elapsedSeconds} seconds.`);
}

// 1. Get all users who own portfolios and their tokens
async function getAllUsersWithPortfolios() {
  const query = `
    SELECT DISTINCT u.id, u.access_token
    FROM users u
    JOIN portfolios p ON u.id = p.user_id
    WHERE u.access_token IS NOT NULL
  `;
  await poolConnect;
  const result = await pool.request().query(query);
  return result.recordset;
}

// 2. For a user, find post_ids needing update (last update older than cooldown)
async function getStalePostIdsForUser(userId) {
  const query = `
    SELECT p.stock_symbol
FROM portfolios p
LEFT JOIN (
  SELECT stock_symbol, user_id, MAX(timestamp) AS last_updated
  FROM stock_price_history
  GROUP BY stock_symbol, user_id
) sph
  ON p.stock_symbol = sph.stock_symbol AND sph.user_id = p.user_id
WHERE p.user_id = @userId
  AND (sph.last_updated IS NULL OR sph.last_updated < DATEADD(minute, -${COOLDOWN_MINUTES}, SYSUTCDATETIME()))

  `;
  const request = pool.request();
  request.input('userId', sql.Int, userId);
  const result = await request.query(query);
  return result.recordset.map(row => row.stock_symbol);
}

// 3. Fetch posts info from Reddit API by post IDs
// postIds: array of post fullnames like ['t3_abc', 't3_xyz']
async function fetchPostsFromReddit(postIds, accessToken) {
  if (postIds.length === 0) return [];

  // Reddit API info endpoint allows up to 100 IDs at once
  const idsParam = postIds.join(',');
  const url = `https://oauth.reddit.com/api/info?id=${idsParam}`;

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'FantasyStocks/1.0'
      }
    });

    // Return array of posts with id and score
    return response.data.data.children.map(c => ({
      id: c.data.id,
      score: c.data.score
    }));
  } catch (err) {
    console.error('Reddit API fetch error:', err.response?.data || err.message);
    return [];
  }
}

// 4. Insert multiple price history rows for a user in batch
async function insertStockPriceHistories(userId, posts) {
  if (posts.length === 0) return;

  // Using a single INSERT with multiple VALUES
  const values = [];
  const input = {};

  posts.forEach((post, i) => {
    values.push(`(@userId, @stock_symbol${i}, @score${i}, SYSUTCDATETIME())`);
    input[`stock_symbol${i}`] = { type: sql.NVarChar(10), value: post.id };
    input[`score${i}`] = { type: sql.Int, value: post.score };
  });

  const query = `
    INSERT INTO stock_price_history (user_id, stock_symbol, score, timestamp)
    VALUES ${values.join(', ')}
  `;

  const request = pool.request();
  request.input('userId', sql.Int, userId);
  for (const key in input) {
    request.input(key, input[key].type, input[key].value);
  }

  await request.query(query);
}

module.exports = { 
  updateAllTrackedStockPrices,
  startPriceUpdateCron
};
