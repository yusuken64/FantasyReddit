const fetch = global.fetch;

const redditHeaders = {
  'User-Agent': 'fantasy-reddit-app/0.1 (by u/yusuken64)',
};

exports.getRisingPosts = async (req, res) => {
  try {
    const response = await fetch('https://www.reddit.com/r/all/rising.json', {
      headers: redditHeaders
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Failed to fetch rising posts:', err);
    res.status(500).send('Error fetching rising posts');
  }
};

exports.getHotPosts = async (req, res) => {
  try {
    const response = await fetch('https://www.reddit.com/r/all/hot.json', {
      headers: redditHeaders
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Failed to fetch hot posts:', err);
    res.status(500).send('Error fetching hot posts');
  }
};

exports.getNewPosts = async (req, res) => {
  try {
    const response = await fetch('https://www.reddit.com/r/all/new.json', {
      headers: redditHeaders
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Failed to fetch new posts:', err);
    res.status(500).send('Error fetching new posts');
  }
};

exports.getSubredditPosts = async (req, res) => {
  const { subreddit } = req.params;
  try {
    const response = await fetch(`https://www.reddit.com/r/${subreddit}.json`, {
      headers: redditHeaders
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error(`Failed to fetch posts from subreddit ${subreddit}:`, err);
    res.status(500).send('Error fetching subreddit posts');
  }
};

exports.getPostById = async (req, res) => {
  const { id: postId } = req.params;
  try {
    const response = await fetch(`https://www.reddit.com/api/info.json?id=t3_${postId}`, {
      headers: redditHeaders
    });
    if (!response.ok) {
      return res.status(response.status).send('Failed to fetch post from Reddit');
    }

    const data = await response.json();
    const post = data.data.children[0]?.data;

    if (!post) return res.status(404).send('Post not found');
    res.json(post);
  } catch (err) {
    console.error('Error fetching single Reddit post:', err);
    res.status(500).send('Internal server error');
  }
};
