const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const db = require('./database')

const app = express()
const PORT = 5000
const JWT_SECRET = 'your-very-secure-secret'
const { buy, sell } = require('./trades');

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}))
app.use(cookieParser())
app.use(express.json())

// Signup route
app.post('/signup', async (req, res) => {
  const { username, password } = req.body
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password' })

  const userExists = db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)
  if (userExists) return res.status(400).json({ error: 'Username already exists' })

  const hashed = await bcrypt.hash(password, 10)
  const info = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hashed)

  res.json({ message: 'User created' })
})

// Login route
app.post('/login', async (req, res) => {
  const { username, password } = req.body
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password' })

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username)
  if (!user) return res.status(401).json({ error: 'Invalid credentials' })

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

  const token = jwt.sign({ username, id: user.id }, JWT_SECRET, { expiresIn: '1h' })
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax' })
  res.json({ message: 'Logged in' })
})

app.get('/me', authMiddleware, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Unauthorized: no user info' });
    }

    const stmt = db.prepare('SELECT username, credits FROM users WHERE id = ?');
    const user = stmt.get(req.user.id);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    res.json({ username: user.username, credits: user.credits });
  } catch (err) {
    console.error('Error in /me:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Middleware to protect routes
function authMiddleware(req, res, next) {
  const token = req.cookies.token
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}

// Buy stock route
app.post('/buy', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { symbol, quantity = 1 } = req.body;

  try {
    const redditRes = await fetch(`https://www.reddit.com/by_id/t3_${symbol}.json`);
    const post = (await redditRes.json())?.data?.children?.[0]?.data;
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const price = post.score;

    try {
      buy(userId, symbol, quantity, price);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    res.json({ success: true, price });
  } catch (err) {
    res.status(500).json({ error: 'Failed to complete purchase' });
  }
});

app.post('/sell', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { symbol, quantity = 1 } = req.body;

  try {
    const redditRes = await fetch(`https://www.reddit.com/by_id/t3_${symbol}.json`);
    const post = (await redditRes.json())?.data?.children?.[0]?.data;
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const price = post.score;

    try {
      sell(userId, symbol, quantity, price);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    res.json({ success: true, price });
  } catch (err) {
    res.status(500).json({ error: 'Failed to complete sale' });
  }
});

// Get user portfolio
app.get('/portfolio', authMiddleware, (req, res) => {
  const userId = req.user.id
  const portfolio = db.prepare('SELECT * FROM portfolios WHERE user_id = ?').all(userId)
  res.json(portfolio)
})

app.get('/api/reddit-posts', async (req, res) => {
  try {
    const response = await fetch('https://www.reddit.com/r/wallstreetbets/hot.json?limit=15')
    if (!response.ok) {
      return res.status(response.status).send('Failed to fetch from Reddit')
    }
    const data = await response.json()
    res.json(data)
  } catch (err) {
    console.error('Reddit fetch error:', err)
    res.status(500).send('Server error fetching Reddit data')
  }
})

app.get('/api/reddit-posts/hot', async (req, res) => {
  try {
    const response = await fetch('https://www.reddit.com/r/all/hot.json')
    const data = await response.json()
    res.json(data)
  } catch (err) {
    console.error('Failed to fetch hot posts:', err)
    res.status(500).send('Error fetching hot posts')
  }
})

app.get('/api/reddit-posts/new', async (req, res) => {
  try {
    const response = await fetch('https://www.reddit.com/r/all/new.json')
    const data = await response.json()
    res.json(data)
  } catch (err) {
    console.error('Failed to fetch new posts:', err)
    res.status(500).send('Error fetching new posts')
  }
})

app.get('/api/reddit-posts/subreddit/:subreddit', async (req, res) => {
  const { subreddit } = req.params
  try {
    const response = await fetch(`https://www.reddit.com/r/${subreddit}.json`)
    const data = await response.json()
    res.json(data)
  } catch (err) {
    console.error(`Failed to fetch posts from subreddit ${subreddit}:`, err)
    res.status(500).send('Error fetching subreddit posts')
  }
})

app.get('/api/reddit-post/:id', async (req, res) => {
  const postId = req.params.id
  try {
    const redditResponse = await fetch(`https://www.reddit.com/api/info.json?id=t3_${postId}`)
    
    if (!redditResponse.ok) {
      return res.status(redditResponse.status).send('Failed to fetch post from Reddit')
    }

    const data = await redditResponse.json()
    const post = data.data.children[0]?.data

    if (!post) {
      return res.status(404).send('Post not found')
    }

    res.json(post)
  } catch (err) {
    console.error('Error fetching single Reddit post:', err)
    res.status(500).send('Internal server error')
  }
})


app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
})
