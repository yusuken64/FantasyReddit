const express = require('express');
const router = express.Router();
const database = require('../database');

router.get('/price-history', async (req, res) => {
  try {
    const { stockSymbol, start, end } = req.query;

    if (!stockSymbol || !start || !end) {
      return res.status(400).json({ error: 'Missing required query parameters.' });
    }
    
    const startDate = new Date(start);
    const endDate = new Date(end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format.' });
    }
    await database.poolConnect;

    const request = database.pool.request();
    request.input('stockSymbol', database.sql.NVarChar(10), stockSymbol);
    request.input('startTime', database.sql.DateTime2, startDate);
    request.input('endTime', database.sql.DateTime2, endDate);

    const query = `
WITH Ranked AS (
  SELECT 
    timestamp, 
    price,
    ROW_NUMBER() OVER (ORDER BY timestamp ASC) AS rn,
    COUNT(*) OVER () AS total
  FROM stock_price_history
  WHERE stock_symbol = @stockSymbol
    AND timestamp BETWEEN @startTime AND @endTime
)
SELECT timestamp, price
FROM Ranked
WHERE total <= 50
   OR rn % CAST(CEILING(CAST(total AS float) / 50) AS INT) = 1
ORDER BY timestamp ASC;
    `;

    const result = await request.query(query);

    res.set('Cache-Control', 'public, max-age=60');
    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching price history:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;