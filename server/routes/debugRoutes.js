const express = require('express');
const router = express.Router();

// GET /env - output all environment variables (for debugging only)
router.get('/env', (req, res) => {
  res.json(process.env);
});

module.exports = router;