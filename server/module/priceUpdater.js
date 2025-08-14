// priceUpdater.js
//const { pool, sql, poolConnect, ready } = require('../database');
const database = require('../database');
const axios = require('axios');
const cron = require('node-cron');
const { calculatePrice } = require('./priceCalculator');

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
      await updatePortfolioValuesBulk();
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

  const users = await getAllUsers();

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

// 1. Get all users
async function getAllUsers() {
  try {
    await database.poolConnect;
    const query = `
      SELECT u.id, u.username, u.access_token, u.credits
      FROM users u
      WHERE u.access_token IS NOT NULL
    `;
    const result = await database.pool.request().query(query);
    return result.recordset;
  } catch (err) {
    console.error('Error fetching all users:', err);
    return [];
  }
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

  const request = database.pool.request();
  request.input('userId', database.sql.Int, userId);
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

  const prices = await Promise.all(posts.map((post) => calculatePrice(post)));

  posts.forEach((post, i) => {
    values.push(`(@stock_symbol${i}, @score${i}, @price${i}, SYSUTCDATETIME())`);
    input[`stock_symbol${i}`] = { type: database.sql.NVarChar(10), value: post.id };
    input[`score${i}`] = { type: database.sql.BigInt, value: post.score };
    input[`price${i}`] = { type: database.sql.BigInt, value: prices[i] };
  });

  const query = `
    INSERT INTO stock_price_history (stock_symbol, score, price, timestamp)
    VALUES ${values.join(', ')}
  `;

  const request = database.pool.request();
  for (const key in input) {
    request.input(key, input[key].type, input[key].value);
  }
  await request.query(query);
}

async function updatePortfolioValues() {
  const startTime = Date.now();
  console.log('Portfolio update job started at', new Date(startTime).toISOString());

  const users = await getAllUsers();

  for (const user of users) {
    try {
      const holdings = await getHoldingsForUser(user.id);
      const stockIds = holdings.map(h => h.stockId);

      const prices = await getLatestPricesForSymbols(stockIds);

      const totalValue = holdings.reduce((sum, h) => {
        const score = Number(prices[h.stockId]) || 0; // zero if missing
        const shares = Number(h.shares) || 0;
        return sum + (score * shares);
      }, 0);
      const credits = Number(user.credits) || 0;


      await updateUserTotalValue(user.id, totalValue);
      await insertPortfolioSnapshot(user.id, totalValue, credits)
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
  await database.poolConnect;
  const request = database.pool.request();
  request.input('userId', database.sql.Int, userId);
  const result = await request.query(query);
  return result.recordset; // [{ stockId, shares }, ...]
}

async function updateUserTotalValue(userId, totalValue) {
  const query = `
    UPDATE users
    SET totalScore = @totalValue
    WHERE id = @userId
  `;
  await database.poolConnect;
  const request = database.pool.request();
  request.input('totalValue', database.sql.Float, totalValue); // or sql.Decimal if you prefer
  request.input('userId', database.sql.Int, userId);
  await request.query(query);
}

async function insertPortfolioSnapshot(userId, portfolioValue, credits) {
  const query = `
    INSERT INTO portfolio_value_history (user_id, portfolio_value, credits)
    VALUES (@userId, @portfolioValue, @credits)
  `;
  await database.poolConnect;
  const request = database.pool.request();
  request.input('userId', database.sql.BigInt, userId);
  request.input('portfolioValue', database.sql.BigInt, portfolioValue);
  request.input('credits', database.sql.BigInt, credits);
  await request.query(query);
}

async function getLatestPricesForSymbols(symbols) {
  if (!Array.isArray(symbols) || symbols.length === 0) return {};

  await database.poolConnect;
  const request = database.pool.request();

  symbols.forEach((s, i) => {
    if (typeof s !== 'string') throw new Error(`Invalid symbol at index ${i}`);
    request.input(`s${i}`, database.sql.NVarChar(10), s);
  });

  const symbolList = symbols.map((_, i) => `@s${i}`).join(',');

  const query = `
    WITH RankedPrices AS (
      SELECT
        stock_symbol,
        price,
        ROW_NUMBER() OVER (PARTITION BY stock_symbol ORDER BY timestamp DESC) AS rn
      FROM stock_price_history
      WHERE stock_symbol IN (${symbolList})
    )
    SELECT stock_symbol, price
    FROM RankedPrices
    WHERE rn = 1
  `;

  try {
    const result = await request.query(query);
    return result.recordset.reduce((map, row) => {
      map[row.stock_symbol] = row.price;
      return map;
    }, {});
  } catch (err) {
    console.error('Error fetching latest prices:', err);
    throw err;
  }
}

async function updatePortfolioValuesBulk(batchSize = 5000) {
  const startTime = Date.now();
  console.log('Bulk Portfolio update job started at', new Date(startTime).toISOString());

  let totalProcessed = 0;

  for await (const users of getUsersInBatches(batchSize)) {
    const userIds = users.map(u => u.id);

    // Fetch holdings for this batch
    const holdings = await getHoldingsForUsers(userIds);

    // Pre-group holdings by userId
    const holdingsMap = new Map();
    for (const h of holdings) {
      if (!holdingsMap.has(h.userId)) holdingsMap.set(h.userId, []);
      holdingsMap.get(h.userId).push(h);
    }

    // Collect unique stock IDs
    const stockIds = [...new Set(holdings.map(h => h.stockId))];

    // Get latest prices
    const prices = await getLatestPricesForSymbols(stockIds);

    // Compute snapshots
    const snapshots = users.map(user => {
      const userHoldings = holdingsMap.get(user.id) || [];
      let totalValue = 0n; // Use BigInt

      for (const h of userHoldings) {
        const price = BigInt(prices[h.stockId] ?? 0); // fallback to 0
        const shares = BigInt(h.shares ?? 0);
        totalValue += price * shares;
      }

      return {
        userId: user.id,
        portfolioValue: totalValue,
        credits: BigInt(user.credits ?? 0)
      };
    });

  // Bulk update and insert
  await bulkUpdateUserTotalValues(snapshots);
  await bulkInsertPortfolioSnapshots(snapshots);

  totalProcessed += users.length;
  console.log(`Processed ${totalProcessed} users so far...`);
}

const endTime = Date.now();
console.log('Portfolio update job finished at', new Date(endTime).toISOString());
console.log(`Portfolio update job took ${((endTime - startTime) / 1000).toFixed(2)} seconds.`);
}

async function getHoldingsForUsers(userIds) {
  if (!userIds.length) return [];

  await database.poolConnect;
  const request = database.pool.request();

  // Add each userId as a separate parameter
  const params = userIds.map((id, i) => {
    const paramName = `id${i}`;
    request.input(paramName, database.sql.BigInt, id);
    return `@${paramName}`;
  });

  const query = `
    SELECT user_id AS userId, stock_symbol AS stockId, shares
    FROM holdings
    WHERE user_id IN (${params.join(',')});
  `;

  const result = await request.query(query);
  return result.recordset;
}

async function getUsersBatch(limit, offset) {
  const query = `
    SELECT id, credits
    FROM users
    ORDER BY id
    OFFSET @offset ROWS
    FETCH NEXT @limit ROWS ONLY;
  `;
  await database.poolConnect;
  const request = database.pool.request();
  request.input('offset', database.sql.Int, offset);
  request.input('limit', database.sql.Int, limit);
  const result = await request.query(query);
  return result.recordset;
}

async function* getUsersInBatches(batchSize) {
  let offset = 0;
  let users = [];

  do {
    users = await getUsersBatch(batchSize, offset);
    if (users.length > 0) {
      yield users;
      offset += users.length;
    }
  } while (users.length > 0);
}

async function bulkUpdateUserTotalValues(snapshots) {
  if (snapshots.length === 0) return;

  // Build CASE expression for the update
  const cases = snapshots.map(s => `WHEN ${s.userId} THEN ${s.portfolioValue}`).join(' ');
  const userIds = snapshots.map(s => s.userId).join(',');

  const query = `
    UPDATE users
    SET totalScore = CASE id
      ${cases}
    END
    WHERE id IN (${userIds});
  `;

  await database.poolConnect;
  await database.pool.request().query(query);
}

async function bulkInsertPortfolioSnapshots(snapshots) {
  if (snapshots.length === 0) return;

  const values = snapshots.map((s, i) =>
    `(@userId${i}, @portfolioValue${i}, @credits${i})`
  ).join(',');

  const query = `
    INSERT INTO portfolio_value_history (user_id, portfolio_value, credits)
    VALUES ${values};
  `;

  await database.poolConnect;
  const request = database.pool.request();

  snapshots.forEach((s, i) => {
    request.input(`userId${i}`, database.sql.BigInt, s.userId);
    request.input(`portfolioValue${i}`, database.sql.BigInt, s.portfolioValue);
    request.input(`credits${i}`, database.sql.BigInt, s.credits);
  });

  await request.query(query);
}

module.exports = {
  updatePortfolioValuesBulk,
  startPriceUpdateCron,
  COOLDOWN_MINUTES
};
