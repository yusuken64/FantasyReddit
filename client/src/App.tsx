import { useContext } from 'react'
import { AuthContext } from './context/AuthContext'
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import Login from './components/LoginWithReddit'
import { RedditStocks } from './components/RedditStocks'
import Portfolio from './components/Portfolio'
import Leaderboard from './components/Leaderboard';
import Debug from './components/Debug';
import 'bootstrap/dist/css/bootstrap.min.css';
import { AppBar, Toolbar, Button, Typography } from '@mui/material'

function Navigation() {
  const { username, credits, logout } = useContext(AuthContext)
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/')
  }

  const navLinks = [
    { to: '/', label: 'Home', end: true },
    { to: '/redditStocks', label: 'Stocks' },
    { to: '/portfolio', label: 'Portfolio' },
    { to: '/leaderboard', label: 'Leaderboard' },
    { to: '/debug', label: 'Debug' }
  ]

  return (
    <AppBar position="static" color="default" elevation={1}>
      <Toolbar sx={{ justifyContent: 'center', gap: 3 }}>
        {navLinks.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            style={({ isActive }) => ({
              textDecoration: 'none',
              color: isActive ? '#1976d2' : '#555',
              borderBottom: isActive ? '2px solid #1976d2' : 'none',
              paddingBottom: 4,
              fontWeight: isActive ? '600' : '400',
            })}
          >
            {label}
          </NavLink>
        ))}

        {!username && (
          <>
            <NavLink
              to="/login"
              style={({ isActive }) => ({
                textDecoration: 'none',
                color: isActive ? '#1976d2' : '#555',
                borderBottom: isActive ? '2px solid #1976d2' : 'none',
                paddingBottom: 4,
                fontWeight: isActive ? '600' : '400',
              })}
            >
              Login
            </NavLink>
          </>
        )}

        {username && (
          <>
            <Typography variant="body2" color="textSecondary" sx={{ ml: 2, mr: 1, alignSelf: 'center' }}>
              Hello, <strong>{username}</strong> ({credits ?? 0} credits)
            </Typography>
            <Button variant="text" color="error" onClick={handleLogout} aria-label="Logout">
              Logout
            </Button>
          </>
        )}
      </Toolbar>
    </AppBar>
  )
}

import { FaTwitter, FaDiscord } from 'react-icons/fa'

function HomePage() {
  return (
    <div
      role="main"
      className="container my-5 p-4 bg-white rounded shadow-sm"
      style={{ maxWidth: '600px' }}
    >
      <h1 className="display-4 mb-4">Welcome to Fantasy Reddit Stocks</h1>
      <p className="lead text-secondary mb-4">
        This is a fantasy stock market where the value of “stocks” depends on how hot a Reddit thread is.
        The hotness rises and falls based on how much engagement the thread gets — like upvotes, comments, and shares.
      </p>
      <p className="text-secondary mb-4">
        Buy shares in threads you think will get popular, track your portfolio, and watch how your investments change as the conversation evolves.
      </p>
      <p className="text-secondary mb-4">
        Use the navigation links above to explore posts, manage your portfolio, and dive into the social media-driven stock market!
      </p>

      <p className="text-warning fst-italic">
        Note: This app is under construction. Things may break or change — please leave feedback on our social channels!
      </p>

      {/* Social media links with icons */}
      <div className="mt-3">
        <h5>Follow us on social media:</h5>
        <div className="d-flex gap-4 fs-3">
          {/* Replace '#' with actual URLs */}
          <a
            href="https://x.com/JuicyChickenDev"
            aria-label="Twitter"
            className="text-primary"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FaTwitter />
          </a>
          <a
            href="https://discord.gg/nJ84kqbbzV"
            aria-label="Discord"
            className="text-primary"
            target="_blank"
            rel="noopener noreferrer">
            <FaDiscord />
          </a>
        </div>
      </div>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow p-4 mb-6">
          <Navigation />
        </header>

        <main className="max-w-xl mx-auto p-4">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/redditStocks" element={<RedditStocks />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/debug" element={<Debug />} /> 
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
