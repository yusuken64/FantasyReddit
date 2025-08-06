// priceUpdater.js
const { pool, sql, poolConnect } = require('../database');
const axios = require('axios');

const cron = require('node-cron');

const COOLDOWN_MINUTES = 5;
let isRunning = false;

function startPriceUpdateCron() {
  cron.schedule('*/5 * * * *', async () => {
    if (isRunning) {
      console.warn('Skipping cron job: previous job still running');
      return;
    }

    isRunning = true;
    console.log('Running price update cron job...');

    try {
      await updateAllTrackedStockPrices();
      await updatePortfolioValues();
    } catch (err) {
      console.error('Price update cron job failed:', err);
    } finally {
      isRunning = false;
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

      const posts = await fetchPostsFromReddit(postFullnames, user.username, user.access_token);
      if (posts.length === 0) continue;

      await insertStockPriceHistories(posts);

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
    SELECT DISTINCT u.id, u.username, u.access_token
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
async function fetchPostsFromReddit(postIds, username, accessToken) {
  if (postIds.length === 0) return [];

  // Reddit API info endpoint allows up to 100 IDs at once
  const idsParam = postIds.join(',');
  const url = `https://oauth.reddit.com/api/info?id=${idsParam}`;

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,        
        'User-Agent': `FantasyStocks/1.0 (by u/${username})`
      }
    });

    // Return array of posts with id and score
    return response.data.data.children.map(c => ({
      id: c.data.id,
      score: c.data.score
    }));
  } catch (err) {
    console.error(`Reddit API fetch error for ${username}:`, err.message);
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

async function updatePortfolioValues() {
  const startTime = Date.now();
  console.log('Portfolio update job started at', new Date(startTime).toISOString());

  const users = await getAllUsersWithHoldings();

  for (const user of users) {
    try {
      const holdings =  await getHoldingsForUser(user.id);
      const stockIds = holdings.map(h => h.stockId);

      const prices = await getLatestPricesForSymbols(stockIds);
      if (Object.keys(prices).length === 0) continue;

      const totalValue = holdings.reduce((sum, h) => {
        const score = prices[h.stockId] ?? 0;
        return sum + (score * h.shares);
      }, 0);
      
      await updateUserTotalValue(user.id, totalValue);
    } catch (err) {
      console.error(`Error updating prices for user ${user.id}:`, err);
    }
  }
  
  const endTime = Date.now();
  console.log('Portfolio update job finished at', new Date(endTime).toISOString());

  const elapsedSeconds = ((endTime - startTime) / 1000).toFixed(2);
  console.log(`Portfolio update job took ${elapsedSeconds} seconds.`);
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

async function getLatestPricesForSymbols(symbols) {
  if (!Array.isArray(symbols) || symbols.length === 0) return {};

  await poolConnect;
  const request = pool.request();

  symbols.forEach((s, i) => {
    if (typeof s !== 'string') throw new Error(`Invalid symbol at index ${i}`);
    request.input(`s${i}`, sql.NVarChar(10), s);
  });

  const symbolList = symbols.map((_, i) => `@s${i}`).join(',');

  const query = `
    WITH RankedPrices AS (
      SELECT
        stock_symbol,
        score,
        ROW_NUMBER() OVER (PARTITION BY stock_symbol ORDER BY timestamp DESC) AS rn
      FROM stock_price_history
      WHERE stock_symbol IN (${symbolList})
    )
    SELECT stock_symbol, score
    FROM RankedPrices
    WHERE rn = 1
  `;

  try {
    const result = await request.query(query);
    return result.recordset.reduce((map, row) => {
      map[row.stock_symbol] = row.score;
      return map;
    }, {});
  } catch (err) {
    console.error('Error fetching latest prices:', err);
    throw err;
  }
}

module.exports = {
  updateAllTrackedStockPrices,
  updatePortfolioValues,
  startPriceUpdateCron,
  COOLDOWN_MINUTES
};
