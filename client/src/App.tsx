import { useContext, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useNavigate, Outlet, Navigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';
import Login from './components/LoginWithReddit';
import { RedditStocks } from './components/RedditStocks';
import Holdings from './components/Holdings';
import Leaderboard from './components/Leaderboard';
import Debug from './components/Debug';
import Transactions from './components/Transactions';
import Portfolio from './components/Portfolio';

import {
  AppBar,
  Toolbar,
  Button,
  Typography,
  Box,
  Paper,
  Stack,
  Container,
  IconButton,
} from '@mui/material';

import { FaTwitter, FaDiscord } from 'react-icons/fa';

function Navigation() {
  const { username, credits, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    console.log('API URL from env:', import.meta.env.VITE_API_URL);
  }, []);

  function handleLogout() {
    logout();
    navigate('/');
  }

  function navLinkStyle({ isActive }: { isActive: boolean }) {
    return {
      textDecoration: 'none',
      color: isActive ? '#1976d2' : '#555',
      borderBottom: isActive ? '2px solid #1976d2' : 'none',
      paddingBottom: 4,
      fontWeight: isActive ? '600' : '400',
    };
  }

  type NavLinkItem = {
    to: string;
    label: string;
    end?: boolean;
  };

  const publicLinks: NavLinkItem[] = [{ to: '/', label: 'Home', end: true }];

  const privateLinks: NavLinkItem[] = [
    { to: '/redditStocks', label: 'Stocks' },
    { to: '/holdings', label: 'Holdings' },
    // { to: '/leaderboard', label: 'Leaderboard' },
    // { to: '/debug', label: 'Debug' },
    { to: '/transactions', label: 'Log' },
  ];

  const linksToShow = [...(!username ? publicLinks : []), ...(username ? privateLinks : [])];

  return (
    <AppBar position="static" color="default" elevation={1}>
      <Toolbar sx={{ justifyContent: 'center', gap: 3 }}>
        {linksToShow.map(({ to, label, end }) => (
          <NavLink key={to} to={to} end={end} style={navLinkStyle}>
            {label}
          </NavLink>
        ))}

        {!username && (
          <NavLink to="/login" style={navLinkStyle}>
            Login
          </NavLink>
        )}

        {username && (
          <>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                ml: 2,
                mr: 1,
                alignSelf: 'center',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
              onClick={() => navigate('/portfolio')}
              role="button"
              tabIndex={0}
              aria-label={`Go to ${username}'s portfolio`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') navigate('/portfolio');
              }}
            >
              Hello, <strong>{username}</strong> ({credits ?? 0} credits)
            </Typography>
            <Button variant="text" color="error" onClick={handleLogout} aria-label="Logout">
              Logout
            </Button>
          </>
        )}
      </Toolbar>
    </AppBar>
  );
}

function HomePage() {
  return (
    <Box display="flex" justifyContent="center" mt={5}>
      <Paper elevation={3} sx={{ p: 4, maxWidth: 600, width: '100%' }}>
        <Typography variant="h3" gutterBottom>
          Welcome to Fantasy Reddit Stocks
        </Typography>

        <Typography variant="h6" color="text.secondary" gutterBottom>
          This is a fantasy stock market where the value of “stocks” depends on how hot a Reddit thread is.
          The hotness rises and falls based on how much engagement the thread gets — like upvotes, comments, and shares.
        </Typography>

        <Typography color="text.secondary" paragraph>
          Buy shares in threads you think will get popular, track your holdings, and watch how your investments change as the conversation evolves.
        </Typography>

        <Typography color="text.secondary" paragraph>
          Use the navigation links above to explore posts, manage your holdings, and dive into the social media-driven stock market!
        </Typography>

        <Typography variant="body1" color="warning.main" fontStyle="italic">
          Note: This app is under construction. Things may break or change — please leave feedback on our social channels!
        </Typography>

        <Box mt={4}>
          <Typography variant="h6" gutterBottom>
            Follow us on social media:
          </Typography>
          <Stack direction="row" spacing={3}>
            <IconButton
              component="a"
              href="https://x.com/JuicyChickenDev"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Twitter"
              color="primary"
            >
              <FaTwitter />
            </IconButton>
            <IconButton
              component="a"
              href="https://discord.gg/nJ84kqbbzV"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Discord"
              color="primary"
            >
              <FaDiscord />
            </IconButton>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}

function PrivateRoute() {
  const { username } = useContext(AuthContext);
  return username ? <Outlet /> : <Navigate to="/login" />;
}

function App() {
  return (
    <BrowserRouter>
      <Box minHeight="100vh" bgcolor="grey.50">
        <Box component="header" bgcolor="white" boxShadow={1} p={2} mb={6}>
          <Navigation />
        </Box>

        <Container component="main" maxWidth="sm">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<Login />} />
            <Route element={<PrivateRoute />}>
              <Route path="/redditStocks" element={<RedditStocks />} />
              <Route path="/holdings" element={<Holdings />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/debug" element={<Debug />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/portfolio" element={<Portfolio />} />
            </Route>
          </Routes>
        </Container>
      </Box>
    </BrowserRouter>
  );
}

export default App;