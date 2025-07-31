const { pool, poolConnect } = require('../database');

/**
 * Get leaderboard of users sorted by credits
 * Route: GET /leaderboard
 * Query params: limit, offset (optional pagination)
 */
exports.getLeaderboard = async (req, res) => {
  let { limit = 10, offset = 0 } = req.query;
  limit = parseInt(limit);
  offset = parseInt(offset);

  try {
    await poolConnect;

    // Query users ordered by credits descending
    const result = await pool.request()
      .input('limit', limit)
      .input('offset', offset)
      .query(`
        SELECT username, credits
        FROM users
        ORDER BY credits DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `);

    // Also get total count for pagination
    const countResult = await pool.request()
      .query('SELECT COUNT(*) AS total FROM users');

    const total = countResult.recordset[0]?.total || 0;

    res.json({
      total,
      data: result.recordset,
    });
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
