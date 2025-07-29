import { useContext } from 'react'
import { AuthContext } from './context/AuthContext'
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import Signup from './components/Signup'
import Login from './components/Login'
import { RedditStocks } from './components/RedditStocks'
import Portfolio from './components/Portfolio'
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
              to="/signup"
              style={({ isActive }) => ({
                textDecoration: 'none',
                color: isActive ? '#1976d2' : '#555',
                borderBottom: isActive ? '2px solid #1976d2' : 'none',
                paddingBottom: 4,
                fontWeight: isActive ? '600' : '400',
              })}
            >
              Signup
            </NavLink>
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

function HomePage() {
  return (
    <div className="container my-5 p-4 bg-white rounded shadow-sm" style={{ maxWidth: '600px' }}>
      <h1 className="display-4 mb-4">Welcome to Fantasy Reddit Stocks</h1>
      <p className="lead text-secondary mb-4">
        This app lets you simulate buying and selling “stocks” based on trending Reddit posts,
        primarily from r/wallstreetbets. Track your portfolio, buy shares in posts you like,
        and see how your investments perform as post scores change over time.
      </p>
      <p className="text-secondary">
        Use the navigation links above to browse your portfolio, explore popular Reddit posts,
        and engage with the fantasy stock market built around social media trends!
      </p>
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
            <Route path="/signup" element={<Signup />} />
            <Route path="/login" element={<Login />} />
            <Route path="/redditStocks" element={<RedditStocks />} />
            <Route path="/portfolio" element={<Portfolio />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
