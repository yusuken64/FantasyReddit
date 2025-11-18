import { AuthContext } from './context/AuthContext';
import Login from './components/LoginWithReddit';
import { RedditStocks } from './components/RedditStocks';
import Holdings from './components/Holdings';
import Leaderboard from './components/Leaderboard';
import Debug from './components/Debug';
import Transactions from './components/Transactions';
import Portfolio from './components/Portfolio';
import Options from './components/Options';

import './ReactOverrides.css';
import '../staticRestyleCode/public/css/base/base.css';

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
                        <a className="underline-hover" href="#">
                            <span>Fantasy</span><span className="text-orange">Reddit</span>
                        </a>
                    </h1>
                </li>

                <li className="nav-item toggle-sidebar-form-item">
                    <form id="toggle-sidebar-form">
                        <label htmlFor="btn--toggle-sidebar" className="sr-only">Toggle side-bar</label>

                        <button id="btn--toggle-sidebar" type="button" aria-controls="sidebar" aria-expanded="false">
                        </button>
                    </form>
                </li>

                {/* <!-- Not sure that this is the best BEM naming, but it'll do. --> */}
                <li className="nav-item search-item">
                    <form id="search-form" action="#" method="GET">
                        <div className="icon-field-wrapper">
                            <svg className="field-icon" viewBox="0 0 27 24">
                                <title>A magnifying glass icon</title>
                                <use href="./assets/svg/magnification-list-icon.svg#magnification-list-icon"></use>
                            </svg>

                            <input id="search-field" type="text" placeholder="Search for threads" name="search-query"/>
                        </div>
                    </form>
                </li>

                {/* <!-- Use .account-info-item--logged-in or .account-info-item--logged-out depending on auth state --> */}
                <li className="nav-item account-info-item--logged-out">
                    {/* <!-- if loggedin -->
                    <!-- populate with logged-in-header-partial.html -->
                    <!-- else -->
                    <!-- logged-out-header-partial.html: --> */}
                    <a href="#" className="btn btn--orange btn--register">Register</a>
                    <a href="#" className="btn btn--black btn--login">Login</a>
                    {/* <!-- endif --> */}
                </li>
            </ul>
        </nav>

        {/* <!-- <noscript> is turned into a <span> on browsers, so add create a class to target in CSS --> */}
        <noscript className="noscript">
            <p>Please enable JavaScript for interactive functionality to work correctly.</p>
        </noscript>
    </header>
  );
}

function Sidebar() {
  // const { username, credits } = useContext(AuthContext);

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
                {/* <!-- This sidebar item (should) not displayed if the screen size is GTE a medium breakpoint value. -->
                <!-- Use .account-info-item--logged-in or .account-info-item--logged-out depending on auth state --> */}
                <li className="navlist-item account-info-item--logged-out">
                    {/* <!-- if loggedin -->
                    <!-- populate with logged-in-sidebar-partial.html -->
                    <!-- else -->
                    <!-- logged-out-sidebar-partial.html: --> */}
                    <a href="#" className="btn btn--orange btn--register">Register</a>
                    <a href="#" className="btn btn--black btn--login">Login</a>
                    {/* <!-- end --> */}
                </li>

                <li className="navlist-item">
                    <a className="item-link underline-hover-minus-svg" href="#">
                        <svg className="icon" viewBox="0 0 26 24">
                            <title>Ribbon medal award icon</title>
                            <use href="./assets/svg/ribbon-icon.svg#ribbon-icon"></use>
                        </svg>

                        <p>Top</p>
                    </a>
                </li>
                <li className="navlist-item">
                    <a className="item-link underline-hover-minus-svg" href="#">
                        <svg className="icon" viewBox="0 0 21 24">
                            <title>Fire flame icon</title>
                            <use href="./assets/svg/flame-icon.svg#flame-icon"></use>
                        </svg>

                        <p>Hot</p>
                    </a>
                </li>
                <li className="navlist-item">
                    <a className="item-link underline-hover-minus-svg" href="#">
                        <svg className="icon" viewBox="0 0 26 26">
                            <title>Opposing diagonal arrows icon</title>
                            <use href="./assets/svg/trade-icon.svg#trade-icon"></use>
                        </svg>

                        <p>Transaction History</p>
                    </a>
                </li>
                <li className="navlist-item">
                    <a className="item-link underline-hover-minus-svg" href="#">
                        <svg className="icon" viewBox="0 0 25 18">
                            <title>Folder icon</title>
                            <use href="./assets/svg/folder-icon.svg#folder-icon"></use>
                        </svg>

                        <p>Portfolio</p>
                    </a>
                </li>
            </ul>
        </nav>

        <h3 className="text-orange">Recently Viewed:</h3>

        {/* <!-- Not the best BEM naming, but CSS-in-JS is probably the better alternative. --> */}
        <ul className="recent-thread-list">
            <li className="list__item">
                <a className="item__link" href="#">
                    <img className="thread__icon" src="./media/recent-1.png" alt="Subreddit logo for r/RedesignHelp"/>
                    <p className="thread__subreddit">r/RedesignHelp</p>
                    <p className="thread__title">How to design this this thing...</p>
                </a>
            </li>
            <li className="list__item">
                <a className="item__link" href="#">
                    <img className="thread__icon" src="./media/recent-1.png" alt="Subreddit logo for r/RedesignHelp"/>
                    <p className="thread__subreddit">r/RedesignHelp</p>
                    <p className="thread__title">How to design this this thing...</p>
                </a>
            </li>
            <li className="list__item">
                <a className="item__link" href="#">
                    <img className="thread__icon" src="./media/recent-1.png" alt="Subreddit logo for r/RedesignHelp"/>
                    <p className="thread__subreddit">r/RedesignHelp</p>
                    <p className="thread__title">How to design this this thing...</p>
                </a>
            </li>

            <li className="list__item">
                <a className="item__link" href="#">
                    <img className="thread__icon" src="./media/recent-1.png" alt="Subreddit logo for r/RedesignHelp"/>
                    <p className="thread__subreddit">r/RedesignHelp</p>
                    <p className="thread__title">How to design this this thing...</p>
                </a>
            </li>
            <li className="list__item">
                <a className="item__link" href="#">
                    <img className="thread__icon" src="./media/recent-1.png" alt="Subreddit logo for r/RedesignHelp"/>
                    <p className="thread__subreddit">r/RedesignHelp</p>
                    <p className="thread__title">How to design this this thing...</p>
                </a>
            </li>

            <li className="list__item">
                <a className="item__link" href="#">
                    <img className="thread__icon" src="./media/recent-1.png" alt="Subreddit logo for r/RedesignHelp"/>
                    <p className="thread__subreddit">r/RedesignHelp</p>
                    <p className="thread__title">How to design this this thing...</p>
                </a>
            </li>
            <li className="list__item">
                <a className="item__link" href="#">
                    <img className="thread__icon" src="./media/recent-1.png" alt="Subreddit logo for r/RedesignHelp"/>
                    <p className="thread__subreddit">r/RedesignHelp</p>
                    <p className="thread__title">How to design this this thing...</p>
                </a>
            </li>

            <li className="list__item">
                <a className="item__link" href="#">
                    <img className="thread__icon" src="./media/recent-1.png" alt="Subreddit logo for r/RedesignHelp"/>
                    <p className="thread__subreddit">r/RedesignHelp</p>
                    <p className="thread__title">How to design this this thing...</p>
                </a>
            </li>
            <li className="list__item">
                <a className="item__link" href="#">
                    <img className="thread__icon" src="./media/recent-1.png" alt="Subreddit logo for r/RedesignHelp"/>
                    <p className="thread__subreddit">r/RedesignHelp</p>
                    <p className="thread__title">How to design this this thing...</p>
                </a>
            </li>

            <li className="list__item">
                <a className="item__link" href="#">
                    <img className="thread__icon" src="./media/recent-1.png" alt="Subreddit logo for r/RedesignHelp"/>
                    <p className="thread__subreddit">r/RedesignHelp</p>
                    <p className="thread__title">How to design this this thing...</p>
                </a>
            </li>
        </ul>
    </aside>
  );
}

function HomePage() {
  return (
    <article className="scrollable-container">
<h2 className="text-orange">The best place to discover, own, and trade threads:</h2>        

<div className="card-group">

    {/* <!-- Thread card --> */}
    <article className="card card--thread-card">
        <a href="#">
            {/* BEM can be improved here */}
            <div className="card-publication-info">
                <img className="icon-img" src="./media/recent-1.png" alt="Subreddit logo for r/RedesignHelp"/>
                <p className="subreddit-title">r/RedesignHelp</p>
                <p className="author-name">ZadocPaet</p>
                <p className="date-published">
                    <time dateTime="2017"><span aria-hidden="true">•</span> 8 yr. ago</time>
                </p>
            </div>

            <h3 className="card-title">Official reddit brand hex color codes...</h3>
            <p className="card-body">
                Lorem ipsum dolor sit amet, consectetur adipisicing elit. Illum corporis vero cum, numquam
                necessitatibus obcaecati ratione earum eaque delectus, nobis maiores quisquam ea voluptas eum
                consectetur quidem perferendis nisi pariatur.
            </p>

            <div className="card-engagement-buttons">
                {/* We probably don't need to actually make these into buttons */}
                <div className="btn btn--like">
                    <svg className="icon" viewBox="0 0 18 20">
                        <title>Up arrow icon</title>
                        <use href="./assets/svg/like-icon.svg#like-icon"></use>
                    </svg>

                    <p>
                        3.9k
                        <span className="sr-only">likes</span>
                    </p>
                </div>

                <div className="btn btn--dislike">
                    <svg className="icon" viewBox="0 0 18 20">
                        <title>Down arrow icon</title>
                        <use href="./assets/svg/dislike-icon.svg#dislike-icon"></use>
                    </svg>

                    <p>
                        231
                        <span className="sr-only">dislikes</span>
                    </p>
                </div>
            </div>
        </a>
    </article>

    {/* Price, relative thread growth within x time, share, buy, sell card */}
    <div className="card card--thread-options">
        <h3 className="credit-cost">52 credits</h3>

        <div className="badge badge--growth">
            <div className="icon-wrapper">
                <svg className="icon icon--growth" viewBox="0 0 15 9">
                    <title>Diagonal jagged green arrow icon going from bottom left to top right</title>
                    <use href="./assets/svg/rise-icon.svg#rise-icon"></use>
                </svg>
            </div>

            <p className="growth-amount">
                +35%
                {/* Dynamically populate for a11y */}
                <span className="sr-only">
                    in credit value compared to
                    <time dateTime="2025">five minutes ago</time>
                </span>
            </p>
        </div>

        {/* Share our page on Reddit for +30 credits */}
        {/* Dynamically generate href based on thread */}
        <a className="btn btn--share"
            href="https://www.reddit.com/submit?url=https%3A%2F%2Fexample.com&title=Check+this+out">
            Share for +30 credits
            <svg className="icon" viewBox="0 0 24 24">
                <title>Reddit logo</title>
                <use href="./assets/svg/reddit-icon.svg#reddit-icon"></use>
            </svg>
        </a>

        <button className="btn btn--buy">
            Buy
        </button>

        <button className="btn btn--sell">
            Sell
        </button>
    </div>
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
      <main id="main">
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