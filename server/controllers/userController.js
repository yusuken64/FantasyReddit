const { pool, poolConnect } = require('../database')
const { buy, sell } = require('../trades');
const { fetchPostWithPrice, getAuthenticatedUser } = require('./redditController');
const sql = require('mssql');

/**
 * Get authenticated user's basic info
 * Route: GET /me
 */
exports.getMe = async (req, res) => {
  const userId = req.user?.id

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: no user info' })
  }

  try {
    await poolConnect

    const result = await pool.request()
      .input('id', userId)
      .query('SELECT id, username, credits FROM users WHERE id = @id')

    const user = result.recordset[0]
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json({ id: user.id, username: user.username, credits: user.credits })
  } catch (err) {
    console.error('Error fetching user info:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * Get user's holdings with sorting, pagination
 * Route: GET /holdings
 */
exports.getHoldings = async (req, res) => {
  const userId = req.user.id

  const validSortColumns = ['stock_symbol', 'shares', 'total_spent']
  const validSortDirections = ['ASC', 'DESC']

  let { sortBy, sortDir, limit = 10, offset = 0 } = req.query
  limit = parseInt(limit)
  offset = parseInt(offset)

  if (!validSortColumns.includes(sortBy)) sortBy = 'stock_symbol'
  if (!validSortDirections.includes((sortDir || '').toUpperCase())) sortDir = 'ASC'
  else sortDir = sortDir.toUpperCase()

  try {
    await poolConnect

    // SQL Server pagination syntax: OFFSET ... FETCH NEXT ... ROWS ONLY
    const holdingsQuery = `
      SELECT * FROM holdings
      WHERE user_id = @userId
      ORDER BY ${sortBy} ${sortDir}
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `

    const dataResult = await pool.request()
      .input('userId', userId)
      .input('offset', offset)
      .input('limit', limit)
      .query(holdingsQuery)

    const countResult = await pool.request()
      .input('userId', userId)
      .query('SELECT COUNT(*) AS total FROM holdings WHERE user_id = @userId')

    const total = countResult.recordset[0]?.total || 0

    res.json({ data: dataResult.recordset, total })
  } catch (err) {
    console.error('Error fetching holdings:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * Get details for a specific stock in user's holdings
 * Route: GET /holdings/:stockSymbol
 */
exports.getStock = async (req, res) => {
  const userId = req.user.id
  const { stockSymbol } = req.params

  try {
    await poolConnect

    const result = await pool.request()
      .input('userId', userId)
      .input('stockSymbol', stockSymbol)
      .query(`
        SELECT * FROM holdings
        WHERE user_id = @userId AND stock_symbol = @stockSymbol
      `)

    const entry = result.recordset[0]
    if (!entry) return res.json({}) // return empty object if not found

    res.json(entry)
  } catch (err) {
    console.error('Error fetching stock:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * Sell all shares and remove a stock from user's holdings
 * Route: DELETE /holdings/:stockSymbol
 */
exports.deleteStock = async (req, res) => {
  const userId = req.user.id;
  const { stockSymbol } = req.params;

  try {
    await poolConnect;

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    const request = new sql.Request(transaction);

    // Fetch current holdings entry
    const result = await request
      .input('userId', sql.Int, userId)
      .input('stockSymbol', sql.NVarChar(100), stockSymbol)
      .query(`
        SELECT shares, total_spent FROM holdings
        WHERE user_id = @userId AND stock_symbol = @stockSymbol
      `);

    const entry = result.recordset[0];
    let price = 0;
    
    if (entry) {
      const user = await getAuthenticatedUser(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const redditData = await fetchPostWithPrice(`https://oauth.reddit.com/by_id/t3_${stockSymbol}.json`, user, true);
      const post = redditData?.data?.children?.[0]?.data;
      price = post?.score ?? 0;
    }

    const sharesToSell = entry?.shares ?? 0;
    if (sharesToSell > 0 && price > 0) {
      await sell(userId, stockSymbol, sharesToSell, price);
    }

    // Delete holdings entry
    request.parameters = {};
    await request
      .input('userId', sql.Int, userId)
      .input('stockSymbol', sql.NVarChar(100), stockSymbol)
      .query(`
        DELETE FROM holdings WHERE user_id = @userId AND stock_symbol = @stockSymbol
      `);

    await transaction.commit();
    res.json({
      success: true,
      sold: sharesToSell,
      price,
    });
  } catch (err) {
    console.error('Error deleting stock:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get authenticated user's portfolio summary
 * Route: GET /portfolio
 */
exports.getPortfolio = async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: no user info' });
  }

  try {
    await poolConnect;

    const result = await pool.request()
      .input('userId', userId)
      .query(`
        SELECT 
          u.username,
          u.credits,
          u.totalScore,
          ISNULL(SUM(h.shares * sph.score), 0) AS totalValue,
          COUNT(DISTINCT h.stock_symbol) AS stocksOwned,
          ISNULL(SUM(h.shares), 0) AS totalShares
        FROM users u
        LEFT JOIN holdings h ON h.user_id = u.id
        LEFT JOIN (
          SELECT stock_symbol, MAX(score) AS score
          FROM stock_price_history
          GROUP BY stock_symbol
        ) sph ON sph.stock_symbol = h.stock_symbol
        WHERE u.id = @userId
        GROUP BY u.username, u.credits, u.totalScore
      `);

    const portfolio = result.recordset[0];

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    res.json({
      username: portfolio.username,
      credits: portfolio.credits,
      totalScore: portfolio.totalScore,
      totalValue: Number(portfolio.totalValue),
      stocksOwned: portfolio.stocksOwned,
      totalShares: Number(portfolio.totalShares),
    });
  } catch (err) {
    console.error('Error fetching portfolio:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};