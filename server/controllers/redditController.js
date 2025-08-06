const fetch = global.fetch;
const { pool } = require('../database');
const { getValidAccessToken } = require('./authController');
const { calculatePrice } = require('../module/priceCalculator');

function getPublicHeaders(user) { 
  const username = user?.name ?? 'anonymous';
  return {
    'User-Agent': `fantasy-reddit-app/0.1 (by u/${username})`, 
  };
}

async function fetchPostWithPrice(url, user, useAuth = false) {
  const headers = getPublicHeaders(user);

  if (useAuth) {
    if (!user) throw new Error('Authenticated user required for authorized Reddit API call');
    const token = await getValidAccessToken(user);
    headers.Authorization = `Bearer ${token}`;
  }

  // console.log('Calling Reddit API:', url);
  // console.log('Using token:', headers.Authorization?.slice(0, 30) + '...');
  // console.log('User trying to fetch:', user.username, user.id, user.token_expiry);

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Reddit API responded with status ${response.status}`);
  }
  
  const json = await response.json();

  // Calculate price for all posts asynchronously
  await Promise.all(json.data.children.map(async (child) => {
    const post = child.data;
    post.price = await calculatePrice(post);
  }));

  return json;
}

async function getAuthenticatedUser(req) {
  const result = await pool
    .request()
    .input('id', req.user.id)
    .query('SELECT * FROM users WHERE id = @id');
  return result.recordset[0] || null;
}

exports.getAuthenticatedUser = getAuthenticatedUser;
exports.fetchPostWithPrice = fetchPostWithPrice;

exports.getRisingPosts = async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const data = await fetchPostWithPrice('https://oauth.reddit.com/r/all/rising.json', user, true);
    res.json(data);
  } catch (err) {
    console.error('Failed to fetch rising posts for user:', req.user?.id, err);
    res.status(500).json({ error: 'Error fetching rising posts' });
  }
};

exports.getHotPosts = async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const data = await fetchPostWithPrice('https://oauth.reddit.com/r/all/hot', user, true);
    res.json(data);
  } catch (err) {
    console.error('Failed to fetch hot posts for user:', req.user?.id, err);
    res.status(500).json({ error: 'Error fetching hot posts' });
  }
};

exports.getNewPosts = async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const data = await fetchPostWithPrice('https://oauth.reddit.com/r/all/new', user, true);
    res.json(data);
  } catch (err) {
    console.error('Failed to fetch new posts for user:', req.user?.id, err);
    res.status(500).json({ error: 'Error fetching new posts' });
  }
};

exports.getSubredditPosts = async (req, res) => {
  const { subreddit } = req.params;
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const data = await fetchPostWithPrice(`https://oauth.reddit.com/r/${subreddit}`, user, true);
    res.json(data);
  } catch (err) {
    console.error(`Failed to fetch subreddit ${subreddit} for user:`, req.user?.id, err);
    res.status(500).json({ error: 'Error fetching subreddit posts' });
  }
};

exports.getPostById = async (req, res) => {
  const { id: postId } = req.params;
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const data = await fetchPostWithPrice(`https://oauth.reddit.com/api/info?id=t3_${postId}`, user, true);
    const post = data.data.children[0]?.data;
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json(post);
  } catch (err) {
    console.error('Failed to fetch post by ID for user:', req.user?.id, err);
    res.status(500).json({ error: 'Error fetching post' });
  }
};
