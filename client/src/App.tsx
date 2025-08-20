import { useContext, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Outlet, Navigate, useNavigate } from 'react-router-dom';
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
  Menu,
  MenuItem,
} from '@mui/material';

import { FaTwitter, FaDiscord } from 'react-icons/fa';
import MenuIcon from '@mui/icons-material/Menu';

function Navigation() {
  const { username, credits, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };
  function handleLogout() {
    logout();
    navigate('/');
  }

  useEffect(() => {
    console.log('API URL from env:', import.meta.env.VITE_API_URL);
  }, []);

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
    { to: '/transactions', label: 'History' },
  ];

  const links = [...(!username ? publicLinks : []), ...(username ? privateLinks : [])];

  return (
    <AppBar position="static" color="default" elevation={1}>
      <Toolbar sx={{ justifyContent: "space-between" }}>
        {/* Logo / Title */}
        <Typography
          variant="h6"
          component={NavLink}
          to="/"
          sx={{
            flexGrow: 1,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          Reddit Stocks
        </Typography>

        {/* Desktop links */}
        <Box sx={{ display: { xs: "none", md: "flex" }, gap: 2 }}>
          {links.map(({ to, label }) => (
            <Button key={to} component={NavLink} to={to}>
              {label}
            </Button>
          ))}
          {!username && (
            <Button component={NavLink} to="/login">
              Login
            </Button>
          )}
          {username && (
            <>
              <Button component={NavLink} to="/portfolio">
                {username} ({credits ?? 0})
              </Button>
              <Button variant="text" color="error" onClick={handleLogout}>
                Logout
              </Button>
            </>
          )}
        </Box>

        {/* Mobile menu */}
        <Box sx={{ display: { xs: "flex", md: "none" } }}>
          <IconButton
            size="large"
            edge="end"
            color="inherit"
            onClick={handleMenu}
          >
            <MenuIcon />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={open}
            onClose={handleClose}
            anchorOrigin={{
              vertical: "top",
              horizontal: "right",
            }}
            transformOrigin={{
              vertical: "top",
              horizontal: "right",
            }}
          >
            {links.map(({ to, label }) => (
              <MenuItem
                key={to}
                component={NavLink}
                to={to}
                onClick={handleClose}
              >
                {label}
              </MenuItem>
            ))}
            {username && (
              <>
                <MenuItem onClick={() => { handleClose(); handleLogout(); }}>
                  Logout
                </MenuItem>
              </>
            )}
            {!username && (
              <MenuItem component={NavLink} to="/login" onClick={handleClose}>
                Login
              </MenuItem>
            )}
          </Menu>
          {username && (
            <>
              <MenuItem component={NavLink} to="/portfolio" onClick={handleClose}>
                {username} ({credits ?? 0})
              </MenuItem>
            </>
          )}
        </Box>
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