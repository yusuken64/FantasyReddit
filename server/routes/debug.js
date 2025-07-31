const express = require('express')
const { resetUserAccount, deleteUserAccount } = require('../controllers/debugController')
const requireAuth = require('../middleware/authMiddleware')
const router = express.Router()

router.post('/reset-account', requireAuth, resetUserAccount)
router.post('/delete-account', requireAuth, deleteUserAccount)

module.exports = router
