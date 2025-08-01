const { pool, poolConnect } = require('../database')
const { buy, sell } = require('../trades');
const { getJson, getAuthenticatedUser } = require('./redditController');
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
 * Get user's portfolio with sorting, pagination
 * Route: GET /portfolio
 */
exports.getPortfolio = async (req, res) => {
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
    const portfolioQuery = `
      SELECT * FROM portfolios
      WHERE user_id = @userId
      ORDER BY ${sortBy} ${sortDir}
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `

    const dataResult = await pool.request()
      .input('userId', userId)
      .input('offset', offset)
      .input('limit', limit)
      .query(portfolioQuery)

    const countResult = await pool.request()
      .input('userId', userId)
      .query('SELECT COUNT(*) AS total FROM portfolios WHERE user_id = @userId')

    const total = countResult.recordset[0]?.total || 0

    res.json({ data: dataResult.recordset, total })
  } catch (err) {
    console.error('Error fetching portfolio:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * Get details for a specific stock in user's portfolio
 * Route: GET /portfolio/:stockSymbol
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
        SELECT * FROM portfolios
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
 * Sell all shares and remove a stock from user's portfolio
 * Route: DELETE /portfolio/:stockSymbol
 */
exports.deleteStock = async (req, res) => {
  const userId = req.user.id;
  const { stockSymbol } = req.params;

  try {
    await poolConnect;

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    const request = new sql.Request(transaction);

    // Fetch current portfolio entry
    const result = await request
      .input('userId', sql.Int, userId)
      .input('stockSymbol', sql.NVarChar(100), stockSymbol)
      .query(`
        SELECT shares, total_spent FROM portfolios
        WHERE user_id = @userId AND stock_symbol = @stockSymbol
      `);

    const entry = result.recordset[0];
    let price = 0;
    
    if (entry) {
      const user = await getAuthenticatedUser(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const redditData = await getJson(`https://oauth.reddit.com/by_id/t3_${stockSymbol}.json`, user, true);
      const post = redditData?.data?.children?.[0]?.data;
      price = post?.score ?? 0;
    }

    const sharesToSell = entry?.shares ?? 0;
    if (sharesToSell > 0 && price > 0) {
      await sell(userId, stockSymbol, sharesToSell, price);
    }

    // Delete portfolio entry
    request.parameters = {};
    await request
      .input('userId', sql.Int, userId)
      .input('stockSymbol', sql.NVarChar(100), stockSymbol)
      .query(`
        DELETE FROM portfolios WHERE user_id = @userId AND stock_symbol = @stockSymbol
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
