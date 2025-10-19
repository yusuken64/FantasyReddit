console.log('--- Environment Initialization ---');

const nodeEnv = process.env.NODE_ENV || 'development';
console.log(`Current NODE_ENV value: "${nodeEnv}"`);

let connectionString = process.env.DB_CONNECTION_STRING;

if (connectionString) {
  console.log('Using DB_CONNECTION_STRING from environment');
} else if (nodeEnv !== 'production') {
  console.log('DB_CONNECTION_STRING not set, loading .env.local for local development...');
  const result = require('dotenv').config({ path: '.env.local' });
  if (result.error) {
    console.error('Failed to load .env.local:', result.error);
  } else {
    console.log('.env.local loaded successfully');
    connectionString = process.env.DB_CONNECTION_STRING;
  }
} else {
  console.error('❌ DB_CONNECTION_STRING not set in production!');
  process.exit(1);
}

console.log('--- End of Environment Initialization ---\n');

const database = require('./database');
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
const optionRoutes = require('./routes/option');

const { startPriceUpdateCron, updatePortfolioValuesBulk } = require('./module/priceUpdater');
const { maybeReschedule } = require('./module/optionSettlement');


(async () => {
  try {
    await database.init();

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
    app.use('/', optionRoutes);

    app.listen(PORT, async () => {
      console.log(`Server running at http://localhost:${PORT}`);
      startPriceUpdateCron();

      await updatePortfolioValuesBulk();
      console.log('Price update test run completed.');

      maybeReschedule();
    });

  } catch (err) {
    console.error('Initialization error:', err);
  }
})();