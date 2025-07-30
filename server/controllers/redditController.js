const fetch = global.fetch;

let cachedToken = null;
let tokenExpiresAt = 0;

async function getRedditAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) return cachedToken;

  const auth = Buffer.from(
    `${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`
  ).toString('base64');

  const response = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'password',
      username: process.env.REDDIT_USERNAME,
      password: process.env.REDDIT_PASSWORD,
    }),
  });

  if (!response.ok) {
    console.error(`Failed to fetch token: ${response.status}`);
    throw new Error('Failed to get access token');
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiresAt = now + data.expires_in * 1000 - 60_000; // Refresh 1 minute early
  return cachedToken;
}

function getPublicHeaders() {
  return {
    'User-Agent': 'fantasy-reddit-app/0.1 (by u/Low-Foot-3660)',
  };
}

async function getJson(url, useAuth = false) {
  const headers = getPublicHeaders();

  if (useAuth) {
    const token = await getRedditAccessToken();
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Reddit API responded with status ${response.status}`);
  }

  return response.json();
}

exports.getJson = getJson;

exports.getRisingPosts = async (req, res) => {
  try {
    const data = await getJson('https://oauth.reddit.com/r/all/rising.json', true);
    res.json(data);
  } catch (err) {
    console.error('Failed to fetch rising posts:', err);
    res.status(500).send('Error fetching rising posts');
  }
};

exports.getHotPosts = async (req, res) => {
  try {
    const data = await getJson('https://oauth.reddit.com/r/all/hot', true);
    res.json(data);
  } catch (err) {
    console.error('Failed to fetch hot posts:', err);
    res.status(500).send('Error fetching hot posts');
  }
};

exports.getNewPosts = async (req, res) => {
  try {
    const data = await getJson('https://oauth.reddit.com/r/all/new', true);
    res.json(data);
  } catch (err) {
    console.error('Failed to fetch new posts:', err);
    res.status(500).send('Error fetching new posts');
  }
};

exports.getSubredditPosts = async (req, res) => {
  const { subreddit } = req.params;
  try {
    const data = await getJson(`https://oauth.reddit.com/r/${subreddit}`, true);
    res.json(data);
  } catch (err) {
    console.error(`Failed to fetch subreddit ${subreddit}:`, err);
    res.status(500).send('Error fetching subreddit posts');
  }
};

exports.getPostById = async (req, res) => {
  const { id: postId } = req.params;
  try {
    const data = await getJson(`https://oauth.reddit.com/api/info?id=t3_${postId}`, true);
    const post = data.data.children[0]?.data;
    if (!post) return res.status(404).send('Post not found');
    res.json(post);
  } catch (err) {
    console.error('Failed to fetch post by ID:', err);
    res.status(500).send('Error fetching post');
  }
};