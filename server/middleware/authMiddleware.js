const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET; // read from .env

function authMiddleware(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('JWT verification failed:', err.message);
    res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = authMiddleware;
