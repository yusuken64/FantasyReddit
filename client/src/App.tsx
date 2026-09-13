import { lazy, Suspense, useRef, useState } from 'react'
import { BrowserRouter, NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/auth'
import { message } from './api'
import Market from './components/Market'
import Holdings from './components/Holdings'
import Options from './components/Options'
import History from './components/History'
import Account from './components/Account'
import './index.css'
const Portfolio = lazy(() => import('./components/Portfolio'))
function Private() { const { user, loading } = useAuth(); return loading ? <p>Loading account…</p> : user ? <Outlet /> : <Navigate to="/login" replace /> }
function Shell() {
  const { user, loading, error: authError, logout } = useAuth(), [error, setError] = useState(''), [busy, setBusy] = useState(false), pending = useRef(false)
  async function signOut() { if (pending.current) return; pending.current = true; setBusy(true); try { await logout(); setError('') } catch (e) { setError(message(e)) } finally { pending.current = false; setBusy(false) } }
  return <><header><NavLink to="/" className="brand">Reddit Stocks</NavLink><nav>{user ? <><NavLink to="/redditStocks">Stocks</NavLink><NavLink to="/holdings">Holdings</NavLink><NavLink to="/options">Options</NavLink><NavLink to="/transactions">History</NavLink><NavLink to="/portfolio">Portfolio</NavLink><NavLink to="/account">Account</NavLink><span>{user.username}: {user.credits} credits</span><button disabled={busy} onClick={() => void signOut()}>Logout</button></> : <a href="/api/auth/reddit">Login with Reddit</a>}</nav></header><main>{(error || authError) && <p role="alert">{error || authError}</p>}<Suspense fallback={<p>Loading chart…</p>}><Routes>
    <Route path="/" element={<><h1>Invest in the conversation.</h1><p>Trade shares in Reddit posts with game credits. Start with 10,000 credits and follow your portfolio as conversations evolve.</p><NavLink to={user ? '/redditStocks' : '/login'}>Get started</NavLink></>} />
    <Route path="/login" element={loading ? <p>Loading account…</p> : user ? <Navigate to="/portfolio" replace /> : <><h1>Login</h1><a href="/api/auth/reddit">Continue with Reddit</a></>} />
    <Route element={<Private />}><Route path="/redditStocks" element={<Market />} /><Route path="/holdings" element={<Holdings />} /><Route path="/options" element={<Options />} /><Route path="/transactions" element={<History />} /><Route path="/portfolio" element={<Portfolio />} /><Route path="/account" element={<Account />} /></Route>
    <Route path="*" element={<><h1>Page not found</h1><NavLink to="/">Home</NavLink></>} />
  </Routes></Suspense></main></>
}
export default function App() { return <BrowserRouter><Shell /></BrowserRouter> }
