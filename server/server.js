//require('dotenv').config()
require('dotenv').config({ path: '.env.cloud' });

const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const tradeRoutes = require('./routes/trades');
const userRoutes = require('./routes/user');
const redditRoutes = require('./routes/reddit');
const debugRoutes = require('./routes/debug');
const transactionRoutes = require('./routes/transactions');
const priceHistoryRoutes = require('./routes/priceHistory');

const { startPriceUpdateCron, updateAllTrackedStockPrices } = require('./module/priceUpdater');

const app = express();
const PORT = process.env.PORT || 8080;

const allowedOrigins = [
  'https://orange-wave-047d8e60f.2.azurestaticapps.net',
  'http://localhost:5173'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());

// Routes
app.use('/', authRoutes);
app.use('/', userRoutes);
app.use('/api/', redditRoutes);
app.use('/', tradeRoutes);
app.use('/debug/', debugRoutes);
app.use('/', transactionRoutes);
app.use('/api', priceHistoryRoutes);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);

  startPriceUpdateCron();
});

(async () => {
  try {
    await updateAllTrackedStockPrices();
    console.log('Price update test run completed.');
  } catch (err) {
    console.error('Error during price update run:', err);
  }
})();