const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const tradeRoutes = require('./routes/trades');
const userRoutes = require('./routes/user');
const redditRoutes = require('./routes/reddit');

const app = express();
const PORT = 5000;

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(cookieParser());
app.use(express.json());

// Routes
app.use('/', authRoutes);
app.use('/', userRoutes);
app.use('/api/', redditRoutes);
app.use('/', tradeRoutes);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
