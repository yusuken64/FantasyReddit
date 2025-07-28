import { useContext } from 'react'
import { AuthContext } from './context/AuthContext'
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import { RedditScoreChecker } from './components/RedditScoreChecker'
import Signup from './components/Signup'
import Login from './components/Login'
import { RedditStocks } from './components/RedditStocks'
import Portfolio from './components/Portfolio'

function Navigation() {
  const { username, credits, logout } = useContext(AuthContext)
  const navigate = useNavigate()

  const activeClass = 'text-blue-600 border-b-2 border-blue-600'
  const inactiveClass = 'text-gray-600 hover:text-blue-600'

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <nav className="max-w-xl mx-auto flex space-x-8">
      <NavLink to="/" end className={({ isActive }) => (isActive ? activeClass : inactiveClass)}>
        Home
      </NavLink>

      {!username && (
        <>
          <NavLink to="/signup" className={({ isActive }) => (isActive ? activeClass : inactiveClass)}>
            Signup
          </NavLink>
          <NavLink to="/login" className={({ isActive }) => (isActive ? activeClass : inactiveClass)}>
            Login
          </NavLink>
        </>
      )}

      {username && (
        <>
          <span className="text-gray-700">
            Hello, {username} ({credits ?? 0} credits)
          </span>
          <button
            onClick={handleLogout}
            className="text-gray-600 hover:text-red-600 cursor-pointer"
            aria-label="Logout"
          >
            Logout
          </button>
        </>
      )}

      <NavLink to="/test" className={({ isActive }) => (isActive ? activeClass : inactiveClass)}>
        Test Post
      </NavLink>

      <NavLink to="/redditStocks" className={({ isActive }) => (isActive ? activeClass : inactiveClass)}>
        Stocks
      </NavLink>
      
      <NavLink to="/portfolio" className={({ isActive }) => (isActive ? activeClass : inactiveClass)}>
        Portfolio
      </NavLink>
    </nav>
  )
}

function HomePage() {
  return (
    <div className="max-w-xl mx-auto p-6 bg-white rounded shadow-md">
      <h1 className="text-3xl font-bold mb-4">Home Page</h1>
      <p className="text-gray-700">Welcome! Use the navigation links above to explore the app.</p>
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
            <Route path="/test" element={<RedditScoreChecker />} />
            <Route path="/redditStocks" element={<RedditStocks />} />
            <Route path="/portfolio" element={<Portfolio />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
