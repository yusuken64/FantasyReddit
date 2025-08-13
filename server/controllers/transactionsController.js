const database = require('../database')

// Get all transactions for the authenticated user, optionally with pagination, filtering, and sorting
async function getTransactions(req, res) {
  try {
    const userId = req.user.id

    // Pagination params
    const page = parseInt(req.query.page) || 1
    const pageSize = parseInt(req.query.pageSize) || 50
    const offset = (page - 1) * pageSize

    // Filtering param: action = 'BUY' | 'SELL'
    const actionFilter = req.query.action
    const allowedActions = ['BUY', 'SELL']

    // Sorting params
    const allowedSortFields = ['timestamp', 'stock_symbol', 'action']
    let sortBy = req.query.sortBy
    if (!allowedSortFields.includes(sortBy)) {
      sortBy = 'timestamp'
    }

    let sortDir = (req.query.sortDir || 'DESC').toUpperCase()
    if (sortDir !== 'ASC' && sortDir !== 'DESC') {
      sortDir = 'DESC'
    }

    await database.poolConnect
    const request = database.pool.request()
      .input('userId', database.sql.Int, userId)
      .input('offset', database.sql.Int, offset)
      .input('pageSize', database.sql.Int, pageSize)

    let filterClause = ''
    if (actionFilter && allowedActions.includes(actionFilter)) {
      request.input('actionFilter', database.sql.NVarChar(4), actionFilter)
      filterClause = 'AND action = @actionFilter'
    }

    // Build full query dynamically with filter and sort
    const query = `
      SELECT id, stock_symbol, action, shares, price_per_share, total_cost, timestamp
      FROM transactions
      WHERE user_id = @userId
      ${filterClause}
      ORDER BY ${sortBy} ${sortDir}
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `

    const result = await request.query(query)

    res.json({ transactions: result.recordset })
  } catch (err) {
    console.error('Error fetching transactions:', err)
    res.status(500).json({ error: 'Failed to fetch transactions' })
  }
}

module.exports = {
  getTransactions,
}
