const jwt = require('jsonwebtoken')
const JWT_SECRET = process.env.JWT_SECRET || 'your-very-secure-secret2'
const crypto = require('crypto')
const database = require('../database')

exports.redditLogin = (req, res) => {
  const state = crypto.randomBytes(16).toString('hex') // Optional: store this in session
  const params = new URLSearchParams({
    client_id: process.env.REDDIT_CLIENT_ID,
    response_type: 'code',
    state,
    redirect_uri: process.env.REDDIT_REDIRECT_URI,
    duration: 'permanent',
    scope: 'identity read',
  })
  res.redirect(`https://www.reddit.com/api/v1/authorize?${params}`)
}

const axios = require('axios')
exports.redditCallback = async (req, res) => {
  const { code } = req.query
  if (!code) return res.status(400).json({ error: 'Missing code' })

  try {
    // Exchange code for access token and refresh token
    const tokenRes = await axios.post(
      'https://www.reddit.com/api/v1/access_token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.REDDIT_REDIRECT_URI,
      }),
      {
        auth: {
          username: process.env.REDDIT_CLIENT_ID,
          password: process.env.REDDIT_CLIENT_SECRET,
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    )

    const { access_token, refresh_token, expires_in } = tokenRes.data
    const tokenExpiry = new Date(Date.now() + expires_in * 1000) // expires_in is seconds from now

    // Get Reddit user profile
    const meRes = await axios.get('https://oauth.reddit.com/api/v1/me', {
      headers: { Authorization: `Bearer ${access_token}` },
    })

    const redditUsername = meRes.data.name
    const redditId = meRes.data.id

    await database.poolConnect

    // Check if Reddit user exists in your DB
    let userResult = await database.pool
      .request()
      .input('username', redditUsername)
      .query('SELECT * FROM users WHERE username = @username')

    let user = userResult.recordset[0]

    if (!user) {
      // Create user if new with tokens
      await database.pool
        .request()
        .input('username', redditUsername)
        .input('reddit_id', redditId)
        .input('access_token', access_token)
        .input('refresh_token', refresh_token)
        .input('token_expiry', tokenExpiry)
        .query(`
          INSERT INTO users (username, reddit_id, access_token, refresh_token, token_expiry)
          VALUES (@username, @reddit_id, @access_token, @refresh_token, @token_expiry)
        `)

      userResult = await database.pool
        .request()
        .input('username', redditUsername)
        .query('SELECT * FROM users WHERE username = @username')

      user = userResult.recordset[0]
    } else {
      // Update tokens for existing user
      await database.pool
        .request()
        .input('username', redditUsername)
        .input('access_token', access_token)
        .input('refresh_token', refresh_token)
        .input('token_expiry', tokenExpiry)
        .query(`
          UPDATE users
          SET access_token = @access_token,
              refresh_token = @refresh_token,
              token_expiry = @token_expiry
          WHERE username = @username
        `)
    }

    // Create JWT for your app session
    const token = jwt.sign({ username: user.username, id: user.id }, JWT_SECRET, {
      expiresIn: '1h',
    })

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'none',
      secure: true,
    })

    // Redirect to frontend with login confirmation
    res.redirect(`${process.env.FRONTEND_URL}?loggedIn=true`)
  } catch (err) {
    console.error('Reddit login error:', err)
    res.status(500).json({ error: 'Reddit login failed' })
  }
}

exports.redditLogout = async (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Not logged in' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const username = decoded.username;

    await database.poolConnect;

    // Get refresh token for revocation
    const result = await database.pool
      .request()
      .input('username', username)
      .query(`
        SELECT refresh_token FROM users WHERE username = @username
      `);

    const user = result.recordset[0];
    const refreshToken = user?.refresh_token;

    // Attempt to revoke Reddit token
    if (refreshToken) {
      try {
        await axios.post(
          'https://www.reddit.com/api/v1/revoke_token',
          new URLSearchParams({
            token: refreshToken,
            token_type_hint: 'refresh_token',
          }),
          {
            auth: {
              username: process.env.REDDIT_CLIENT_ID,
              password: process.env.REDDIT_CLIENT_SECRET,
            },
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          }
        );
      } catch (revokeErr) {
        console.warn('Failed to revoke Reddit token:', revokeErr.message);
        // Don't fail logout entirely if Reddit revoke fails
      }
    }

    // Clear Reddit token data in DB
    await database.pool
      .request()
      .input('username', username)
      .query(`
        UPDATE users
        SET access_token = NULL,
            refresh_token = NULL,
            token_expiry = NULL
        WHERE username = @username
      `);

    // Clear session cookie
    res.clearCookie('token', {
      httpOnly: true,
      sameSite: 'none',
      secure: true,
    });

    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Reddit logout error:', err);
    res.status(500).json({ error: 'Logout failed' });
  }
};

async function refreshRedditToken(user) {
  try {
    const res = await axios.post(
      'https://www.reddit.com/api/v1/access_token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: user.refresh_token,
      }),
      {
        auth: {
          username: process.env.REDDIT_CLIENT_ID,
          password: process.env.REDDIT_CLIENT_SECRET,
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    )

    const { access_token, expires_in } = res.data
    const newExpiry = new Date(Date.now() + expires_in * 1000)

    // Update user's access token and expiry in your DB
    await database.pool
      .request()
      .input('access_token', access_token)
      .input('token_expiry', newExpiry)
      .input('userId', user.id)
      .query(`
        UPDATE users SET access_token = @access_token, token_expiry = @token_expiry WHERE id = @userId
      `)

    return access_token
  } catch (error) {
    console.error('Failed to refresh Reddit token:', error)
    throw error
  }
}

async function getValidAccessToken(user) {
  const now = new Date()

  // Check if token is expired or will expire within next 2 minutes
  if (!user.token_expiry || user.token_expiry <= new Date(now.getTime() + 2 * 60 * 1000)) {
    // Refresh token
    const newAccessToken = await refreshRedditToken(user) // use function from previous message

    return newAccessToken
  }

  // Token still valid, return current one
  return user.access_token
}

module.exports = {
  redditLogin: exports.redditLogin,
  redditCallback: exports.redditCallback,
  redditLogout: exports.redditLogout,
  getValidAccessToken,
  refreshRedditToken,
};
