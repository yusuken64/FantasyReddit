const express = require('express');
const auth = require('../middleware/authMiddleware');
const { buyStock, sellStock } = require('../controllers/tradeController');

const router = express.Router();

router.post('/buy', auth, buyStock);
router.post('/sell', auth, sellStock);

module.exports = router;
