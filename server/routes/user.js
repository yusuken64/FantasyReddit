const express = require('express');
const auth = require('../middleware/authMiddleware');
const {
  getMe,
  getHoldings,
  getStock,
  deleteStock
} = require('../controllers/userController');
const {
  getLeaderboard
} = require('../controllers/leaderboardController');

const router = express.Router();

router.get('/me', auth, getMe);
router.get('/holdings', auth, getHoldings);
router.get('/holdings/:stockSymbol', auth, getStock);
router.delete('/holdings/:stockSymbol', auth, deleteStock);
router.get('/leaderboard', auth, getLeaderboard);

module.exports = router;
