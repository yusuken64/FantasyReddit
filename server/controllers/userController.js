const db = require('../database');

/**
 * Get authenticated user's basic info
 * Route: GET /me
 */
exports.getMe = (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: no user info' });
  }

  try {
    const user = db.prepare('SELECT username, credits FROM users WHERE id = ?').get(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ username: user.username, credits: user.credits });
  } catch (err) {
    console.error('Error fetching user info:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get user's portfolio with sorting, pagination
 * Route: GET /portfolio
 */
exports.getPortfolio = (req, res) => {
  const userId = req.user.id;

  const validSortColumns = ['stock_symbol', 'shares', 'total_spent'];
  const validSortDirections = ['ASC', 'DESC'];

  let { sortBy, sortDir, limit = 10, offset = 0 } = req.query;
  limit = parseInt(limit);
  offset = parseInt(offset);

  if (!validSortColumns.includes(sortBy)) sortBy = 'stock_symbol';
  if (!validSortDirections.includes((sortDir || '').toUpperCase())) sortDir = 'ASC';
  else sortDir = sortDir.toUpperCase();

  try {
    const data = db.prepare(`
      SELECT * FROM portfolios
      WHERE user_id = ?
      ORDER BY ${sortBy} ${sortDir}
      LIMIT ? OFFSET ?
    `).all(userId, limit, offset);

    const { total } = db.prepare(`
      SELECT COUNT(*) AS total FROM portfolios WHERE user_id = ?
    `).get(userId);

    res.json({ data, total });
  } catch (err) {
    console.error('Error fetching portfolio:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get details for a specific stock in user's portfolio
 * Route: GET /portfolio/:stockSymbol
 */
exports.getStock = (req, res) => {
  const userId = req.user.id;
  const { stockSymbol } = req.params;

  try {
    const entry = db.prepare(`
      SELECT * FROM portfolios
      WHERE user_id = ? AND stock_symbol = ?
    `).get(userId, stockSymbol);

    if (!entry) return res.json({}); // Return empty object for no data

    res.json(entry);
  } catch (err) {
    console.error('Error fetching stock:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
