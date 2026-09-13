const { buy, sell, canBuy } = require('../trades');

exports.buyStock = async (req, res) => {
  const userId = req.user.id;
  const { symbol, quantity = 1, quoteId } = req.body;
  if (!Number.isSafeInteger(quantity) || quantity <= 0) return res.status(400).json({ error: 'Invalid quantity' });

  try {
    const canProceed = await canBuy(userId, symbol);
    if (!canProceed) {
      return res.status(400).json({ error: 'Holding limit reached. Sell or delete a holding to proceed.' });
    }

    const price = await buy(userId, symbol, quantity, quoteId);
    res.json({ success: true, price });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to complete purchase' });
  }
};

exports.sellStock = async (req, res) => {
  const userId = req.user.id;
  const { symbol, quantity = 1, quoteId } = req.body;
  if (!Number.isSafeInteger(quantity) || quantity <= 0) return res.status(400).json({ error: 'Invalid quantity' });

  try {    
    const price = await sell(userId, symbol, quantity, quoteId);
    res.json({ success: true, price });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to complete sale' });
  }
};
