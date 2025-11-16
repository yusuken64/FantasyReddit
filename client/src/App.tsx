import { AuthContext } from './context/AuthContext';
import Login from './components/LoginWithReddit';
import { RedditStocks } from './components/RedditStocks';
import Holdings from './components/Holdings';
import Leaderboard from './components/Leaderboard';
import Debug from './components/Debug';
import Transactions from './components/Transactions';
import Portfolio from './components/Portfolio';
import Options from './components/Options';

import '../staticRestyleCode/public/css/base/base.css';
import '../staticRestyleCode/public/css/index/index.css';
import { FaTwitter, FaDiscord } from 'react-icons/fa';
import { useContext, useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Outlet, Navigate, useNavigate } from 'react-router-dom';

function Navigation() {
  const { username, credits, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <header id="page-header">
      <nav>
        <ul className="nav-list">
          <li className="nav-item logo-item">
            <h1>
              <NavLink to="/" className="underline-hover">
                <span>Fantasy</span><span className="text-orange">Reddit</span>
              </NavLink>
            </h1>
          </li>

          <li className="nav-item toggle-sidebar-form-item">
            <form id="toggle-sidebar-form">
              <label htmlFor="btn--toggle-sidebar" className="sr-only">Toggle side-bar</label>
              <button
                id="btn--toggle-sidebar"
                type="button"
                aria-controls="sidebar"
                popoverTarget="sidebar"
                popoverTargetAction="toggle"
              />
            </form>
          </li>

          <li className="nav-item search-item">
            <form id="search-form" action="#" method="GET">
              <div className="icon-field-wrapper">
                <svg className="field-icon" viewBox="0 0 27 24">
                  <title>A magnifying glass icon</title>
                  <use href="./assets/svg/magnification-list-icon.svg#magnification-list-icon"></use>
                </svg>
                <input id="search-field" type="text" placeholder="Search for threads" name="search-query" />
              </div>
            </form>
          </li>

          <li className="nav-item account-info-item">
            <p className="username">
              <NavLink to="/portfolio" className="underline-hover underline-hover--orange text-orange">
                {username || 'Guest'}
              </NavLink>
            </p>
            <p className="credits">
              <a className="underline-hover" href="#">
                <span className="credit-amount">{credits ?? 0} credits</span>
              </a>
            </p>
            <button className="btn btn--options" onClick={handleLogout} title="Logout">
              <span className="sr-only">Account Settings</span>
              <svg viewBox="0 0 28 28">
                <title>A cog icon</title>
                <use href="./assets/svg/cog-icon.svg#cog-icon"></use>
              </svg>
            </button>
          </li>
        </ul>
      </nav>

      <noscript className="noscript">
        <p>Please enable JavaScript for interactive functionality to work correctly.</p>
      </noscript>
    </header>
  );
}

function Sidebar() {
  const { username, credits } = useContext(AuthContext);

  const recentThreads = [
    { id: 1, subreddit: 'r/RedesignHelp', title: 'How to design this thing...' },
    { id: 2, subreddit: 'r/RedesignHelp', title: 'How to design this thing...' },
    { id: 3, subreddit: 'r/RedesignHelp', title: 'How to design this thing...' },
  ];

  return (
    <aside id="sidebar" popover="manual">
      <nav>
        <h2 className="sr-only">Navigation:</h2>
        
        <ul className="sidebar-navlist">
          <li className="navlist-item account-info-item">
            <p className="username">
              <NavLink to="/portfolio" className="underline-hover underline-hover--orange text-orange">
                {username || 'Guest'}
              </NavLink>
            </p>
            <p className="credits">
              <a className="underline-hover" href="#">{credits ?? 0} credits</a>
            </p>
          </li>

          <li className="navlist-item">
            <NavLink to="/redditStocks" className="item-link underline-hover-minus-svg">
              <svg className="icon" viewBox="0 0 26 24">
                <title>Ribbon medal award icon</title>
                <use href="./assets/svg/ribbon-icon.svg#ribbon-icon"></use>
              </svg>
              <p>Top</p>
            </NavLink>
          </li>

          <li className="navlist-item">
            <NavLink to="/holdings" className="item-link underline-hover-minus-svg">
              <svg className="icon" viewBox="0 0 21 24">
                <title>Fire flame icon</title>
                <use href="./assets/svg/flame-icon.svg#flame-icon"></use>
              </svg>
              <p>Hot</p>
            </NavLink>
          </li>

          <li className="navlist-item">
            <NavLink to="/options" className="item-link underline-hover-minus-svg">
              <svg className="icon" viewBox="0 0 26 26">
                <title>Opposing diagonal arrows icon</title>
                <use href="./assets/svg/trade-icon.svg#trade-icon"></use>
              </svg>
              <p>Trade</p>
            </NavLink>
          </li>

          <li className="navlist-item">
            <NavLink to="/portfolio" className="item-link underline-hover-minus-svg">
              <svg className="icon" viewBox="0 0 25 18">
                <title>Folder icon</title>
                <use href="./assets/svg/folder-icon.svg#folder-icon"></use>
              </svg>
              <p>Portfolio</p>
            </NavLink>
          </li>
        </ul>
      </nav>

      <h3 className="text-orange">Recently Viewed:</h3>

      <ul className="recent-thread-list">
        {recentThreads.map((thread) => (
          <li key={thread.id} className="list__item">
            <a className="item__link" href="#">
              <img className="thread__icon" src="./media/recent-1.png" alt={`Subreddit logo for ${thread.subreddit}`} />
              <p className="thread__subreddit">{thread.subreddit}</p>
              <p className="thread__title">{thread.title}</p>
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function HomePage() {
  return (
    <article className="scrollable-container">
      <h2 className="text-orange">The best place to discover, own, and trade threads:</h2>
      <div className="card-list">
        {/* ...existing code... */}
      </div>
    </article>
  );
}

function PrivateRoute() {
  const { username } = useContext(AuthContext);
  return username ? <Outlet /> : <Navigate to="/login" />;
}

interface RouteWrapperProps {
  children: ReactNode;
}

function RouteWrapper({ children }: RouteWrapperProps) {
  return (
    <article className="scrollable-container">
      {children}
    </article>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Navigation />
      <Sidebar />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<Login />} />
          <Route element={<PrivateRoute />}>
            <Route path="/redditStocks" element={<RouteWrapper><RedditStocks /></RouteWrapper>} />
            <Route path="/holdings" element={<RouteWrapper><Holdings /></RouteWrapper>} />
            <Route path="/options" element={<RouteWrapper><Options /></RouteWrapper>} />
            <Route path="/leaderboard" element={<RouteWrapper><Leaderboard /></RouteWrapper>} />
            <Route path="/debug" element={<RouteWrapper><Debug /></RouteWrapper>} />
            <Route path="/transactions" element={<RouteWrapper><Transactions /></RouteWrapper>} />
            <Route path="/portfolio" element={<RouteWrapper><Portfolio /></RouteWrapper>} />
          </Route>
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;