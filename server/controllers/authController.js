const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { pool, poolConnect } = require('../database')
const JWT_SECRET = process.env.JWT_SECRET || 'your-very-secure-secret'

exports.signup = async (req, res) => {
  const { username, password } = req.body
  if (!username || !password)
    return res.status(400).json({ error: 'Missing username or password' })

  try {
    await poolConnect

    // Check if user exists
    const userExistsResult = await pool
      .request()
      .input('username', username)
      .query('SELECT 1 FROM users WHERE username = @username')

    if (userExistsResult.recordset.length > 0) {
      return res.status(400).json({ error: 'Username already exists' })
    }

    // Hash password
    const hashed = await bcrypt.hash(password, 10)

    // Insert user
    await pool
      .request()
      .input('username', username)
      .input('password', hashed)
      .query('INSERT INTO users (username, password) VALUES (@username, @password)')

    res.json({ message: 'User created' })
  } catch (err) {
    console.error('Signup error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

exports.login = async (req, res) => {
  const { username, password } = req.body
  if (!username || !password)
    return res.status(400).json({ error: 'Missing username or password' })

  try {
    await poolConnect

    // Get user by username
    const userResult = await pool
      .request()
      .input('username', username)
      .query('SELECT * FROM users WHERE username = @username')

    const user = userResult.recordset[0]
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // Compare password hash
    const passwordMatch = await bcrypt.compare(password, user.password)
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // Generate JWT token
    const token = jwt.sign({ username, id: user.id }, JWT_SECRET, { expiresIn: '1h' })

    // Send token as HttpOnly cookie
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax' })
    res.json({ message: 'Logged in' })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
