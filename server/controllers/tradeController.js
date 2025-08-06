const fetch = global.fetch;
const { buy, sell } = require('../trades');
const { getJson, getAuthenticatedUser } = require('./redditController');

exports.buyStock = async (req, res) => {
  const userId = req.user.id;
  const { symbol, quantity = 1 } = req.body;

  try {
    const canProceed = await canBuy(userId, symbol);
    if (!canProceed) {
      return res.status(400).json({ error: 'Holding limit reached. Sell or delete a holding to proceed.' });
    }

    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const data = await getJson(`https://oauth.reddit.com/by_id/t3_${symbol}.json`, user, true);
    const post = (await data)?.data?.children?.[0]?.data;
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
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const data = await getJson(`https://oauth.reddit.com/by_id/t3_${symbol}.json`, user, true);
    const post = (await data)?.data?.children?.[0]?.data;
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const price = post.score;
    sell(userId, symbol, quantity, price);
    res.json({ success: true, price });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to complete sale' });
  }
};
