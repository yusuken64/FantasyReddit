const express = require('express');
const { redditLogin, redditCallback, redditLogout } = require('../controllers/authController');
const router = express.Router();

router.get('/auth/reddit', redditLogin);
router.get('/auth/reddit/callback', redditCallback)
router.post('/auth/reddit/logout', redditLogout);

module.exports = router;
