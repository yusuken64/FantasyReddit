const express = require('express')
const requireAuth = require('../middleware/authMiddleware')
const { getTransactions } = require('../controllers/transactionsController')

const router = express.Router()

router.get('/transactions', requireAuth, getTransactions)

module.exports = router
