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

  const users = await getAllUsersWithHoldings();

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

      await insertStockPriceHistories(posts);

      const holdings = await getHoldingsForUser(user.id);
      let totalValue = 0;
      for (const item of holdings) {
        const post = posts.find(p => p.id === item.stockId);
        if (post) {
          totalValue += item.shares * post.score; // shares * latest price
        }
      }

      await updateUserTotalValue(user.id, totalValue);
    } catch (err) {
      console.error(`Error updating prices for user ${user.id}:`, err);
    }
  }

  const endTime = Date.now();
  console.log('Price update job finished at', new Date(endTime).toISOString());

  const elapsedSeconds = ((endTime - startTime) / 1000).toFixed(2);
  console.log(`Price update job took ${elapsedSeconds} seconds.`);
}

// 1. Get all users who own holdings and their tokens
async function getAllUsersWithHoldings() {
  const query = `
    SELECT DISTINCT u.id, u.access_token
    FROM users u
    JOIN holdings p ON u.id = p.user_id
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
    FROM holdings p
    LEFT JOIN (
      SELECT stock_symbol, MAX(timestamp) AS last_updated
      FROM stock_price_history
      GROUP BY stock_symbol
    ) sph ON p.stock_symbol = sph.stock_symbol
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

// 4. Insert multiple price history rows in batch
async function insertStockPriceHistories(posts) {
  if (posts.length === 0) return;

  // Using a single INSERT with multiple VALUES
  const values = [];
  const input = {};

  posts.forEach((post, i) => {
    values.push(`(@stock_symbol${i}, @score${i}, SYSUTCDATETIME())`);
    input[`stock_symbol${i}`] = { type: sql.NVarChar(10), value: post.id };
    input[`score${i}`] = { type: sql.Int, value: post.score };
  });

  const query = `
    INSERT INTO stock_price_history (stock_symbol, score, timestamp)
    VALUES ${values.join(', ')}
  `;

  const request = pool.request();
  for (const key in input) {
    request.input(key, input[key].type, input[key].value);
  }
  await request.query(query);
}

async function getHoldingsForUser(userId) {
  const query = `
    SELECT stock_symbol AS stockId, shares
    FROM holdings
    WHERE user_id = @userId
  `;
  await poolConnect;
  const request = pool.request();
  request.input('userId', sql.Int, userId);
  const result = await request.query(query);
  return result.recordset; // [{ stockId, shares }, ...]
}

async function updateUserTotalValue(userId, totalValue) {
  const query = `
    UPDATE users
    SET totalScore = @totalValue
    WHERE id = @userId
  `;
  await poolConnect;
  const request = pool.request();
  request.input('totalValue', sql.Float, totalValue); // or sql.Decimal if you prefer
  request.input('userId', sql.Int, userId);
  await request.query(query);
}

module.exports = {
  updateAllTrackedStockPrices,
  startPriceUpdateCron,
  COOLDOWN_MINUTES
};
