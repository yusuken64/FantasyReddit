const express = require('express');
const {
  getRisingPosts,
  getHotPosts,
  getNewPosts,
  getSubredditPosts,
  getPostById,
} = require('../controllers/redditController');

const router = express.Router();

router.get('/reddit-posts', getRisingPosts);
router.get('/reddit-posts/hot', getHotPosts);
router.get('/reddit-posts/new', getNewPosts);
router.get('/reddit-posts/subreddit/:subreddit', getSubredditPosts);
router.get('/reddit-post/:id', getPostById);

module.exports = router;
