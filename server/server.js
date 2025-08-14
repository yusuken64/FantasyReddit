console.log('--- Environment Initialization ---');

const nodeEnv = process.env.NODE_ENV;
console.log(`Current NODE_ENV value: ${nodeEnv ? `"${nodeEnv}"` : 'undefined (not set)'}`);

if (nodeEnv !== 'production') {
  console.log('NODE_ENV is not "production". Loading environment variables from .env.local file...');
  const result = require('dotenv').config({ path: '.env.local' });
  if (result.error) {
    console.error('Failed to load .env.local:', result.error);
  } else {
    console.log('.env.local loaded successfully. Variables:');
    //console.log(process.env);
  }
} else {
  console.log('NODE_ENV is "production". Skipping .env.local loading and relying on Azure App Service environment variables.');
  //console.log(process.env);
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

const { startPriceUpdateCron, updatePortfolioValuesBulk } = require('./module/priceUpdater');

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

    app.listen(PORT, async () => {
      console.log(`Server running at http://localhost:${PORT}`);
      startPriceUpdateCron();

      await updatePortfolioValuesBulk();
      console.log('Price update test run completed.');
    });

  } catch (err) {
    console.error('Initialization error:', err);
  }
})();