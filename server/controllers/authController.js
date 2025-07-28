const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const JWT_SECRET = 'your-very-secure-secret';

exports.signup = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });

  const userExists = db.prepare('SELECT 1 FROM users WHERE username = ?').get(username);
  if (userExists) return res.status(400).json({ error: 'Username already exists' });

  const hashed = await bcrypt.hash(password, 10);
  db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hashed);

  res.json({ message: 'User created' });
};

exports.login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ username, id: user.id }, JWT_SECRET, { expiresIn: '1h' });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax' });
  res.json({ message: 'Logged in' });
};
