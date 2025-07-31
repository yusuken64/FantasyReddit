const express = require('express');
const {
  getRisingPosts,
  getHotPosts,
  getNewPosts,
  getSubredditPosts,
  getPostById,
} = require('../controllers/redditController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/reddit-posts', authMiddleware, getRisingPosts);
router.get('/reddit-posts/hot', authMiddleware,getHotPosts);
router.get('/reddit-posts/new', authMiddleware,getNewPosts);
router.get('/reddit-posts/subreddit/:subreddit', authMiddleware, getSubredditPosts);
router.get('/reddit-post/:id', authMiddleware, getPostById);

module.exports = router;
