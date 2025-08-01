const express = require('express');
const router = express.Router();
const { pool, sql, poolConnect } = require('../database');

router.get('/price-history', async (req, res) => {
  try {
    const { userId, stockSymbol, start, end } = req.query;

    if (!userId || !stockSymbol || !start || !end) {
      return res.status(400).json({ error: 'Missing required query parameters.' });
    }

    await poolConnect; // ensure connection

    const request = pool.request();
    request.input('userId', sql.Int, parseInt(userId));
    request.input('stockSymbol', sql.NVarChar(10), stockSymbol);
    request.input('startTime', sql.DateTime2, new Date(start));
    request.input('endTime', sql.DateTime2, new Date(end));

    const query = `
      SELECT timestamp, score
      FROM stock_price_history
      WHERE user_id = @userId
        AND stock_symbol = @stockSymbol
        AND timestamp BETWEEN @startTime AND @endTime
      ORDER BY timestamp ASC
    `;

    const result = await request.query(query);

    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching price history:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;