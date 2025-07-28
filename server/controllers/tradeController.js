const fetch = global.fetch;
const { buy, sell } = require('../trades');

exports.buyStock = async (req, res) => {
  const userId = req.user.id;
  const { symbol, quantity = 1 } = req.body;

  try {
    const redditRes = await fetch(`https://www.reddit.com/by_id/t3_${symbol}.json`);
    const post = (await redditRes.json())?.data?.children?.[0]?.data;
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const price = post.score;
    buy(userId, symbol, quantity, price);
    res.json({ success: true, price });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to complete purchase' });
  }
};

exports.sellStock = async (req, res) => {
  const userId = req.user.id;
  const { symbol, quantity = 1 } = req.body;

  try {
    const redditRes = await fetch(`https://www.reddit.com/by_id/t3_${symbol}.json`);
    const post = (await redditRes.json())?.data?.children?.[0]?.data;
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const price = post.score;
    sell(userId, symbol, quantity, price);
    res.json({ success: true, price });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to complete sale' });
  }
};
