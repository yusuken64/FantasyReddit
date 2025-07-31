//require('dotenv').config()
require('dotenv').config({ path: '.env.local' });

const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const tradeRoutes = require('./routes/trades');
const userRoutes = require('./routes/user');
const redditRoutes = require('./routes/reddit');
const debugRoutes = require('./routes/debug');

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

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
