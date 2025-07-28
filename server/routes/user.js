const express = require('express');
const auth = require('../middleware/authMiddleware');
const {
  getMe,
  getPortfolio,
  getStock
} = require('../controllers/userController');

const router = express.Router();

router.get('/me', auth, getMe);
router.get('/portfolio', auth, getPortfolio);
router.get('/portfolio/:stockSymbol', auth, getStock);

module.exports = router;
