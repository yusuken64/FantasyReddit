const express = require('express');
const auth = require('../middleware/authMiddleware');
const {
  getMe,
  getPortfolio,
  getStock,
  deleteStock
} = require('../controllers/userController');
const {
  getLeaderboard
} = require('../controllers/leaderboardController');

const router = express.Router();

router.get('/me', auth, getMe);
router.get('/portfolio', auth, getPortfolio);
router.get('/portfolio/:stockSymbol', auth, getStock);
router.delete('/portfolio/:stockSymbol', auth, deleteStock);
router.get('/leaderboard', auth, getLeaderboard);

module.exports = router;
