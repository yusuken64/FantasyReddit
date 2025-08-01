const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRATION = '1h'; // or '15m', depending on your strategy
const REFRESH_THRESHOLD_SECONDS = 5 * 60; // Refresh if expiring in less than 5 minutes

function authMiddleware(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = decoded;

    // Check how close to expiry the token is
    const now = Math.floor(Date.now() / 1000); // in seconds
    const timeRemaining = decoded.exp - now;

    if (timeRemaining < REFRESH_THRESHOLD_SECONDS) {
      // Issue a new token with the same payload and updated expiry
      const newToken = jwt.sign(
        { id: decoded.id, username: decoded.username }, // customize payload as needed
        JWT_SECRET,
        { expiresIn: JWT_EXPIRATION }
      );

      res.cookie('token', newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        maxAge: 60 * 60 * 1000, // 1 hour in milliseconds
      });
    }

    next();
  } catch (err) {
    console.error('JWT verification failed:', err.message);
    res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = authMiddleware;
