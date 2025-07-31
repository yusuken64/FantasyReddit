import React, { useEffect, useState } from 'react';
import {
  Container,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Box,
  Pagination
} from '@mui/material';

type LeaderboardEntry = {
  username: string;
  credits: number;
};

type LeaderboardResponse = {
  total: number;
  data: LeaderboardEntry[];
};

const Leaderboard: React.FC = () => {
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [limit] = useState(10);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/leaderboard?limit=${limit}&offset=${offset}`
        );
        if (!res.ok) throw new Error('Failed to fetch leaderboard');
        const json: LeaderboardResponse = await res.json();
        setData(json.data);
        setTotal(json.total);
      } catch (err) {
        console.error('Error loading leaderboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [limit, offset]);

  const pageCount = Math.ceil(total / limit);
  const currentPage = offset / limit;

  return (
    <Container maxWidth="md">
      <Typography variant="h4" gutterBottom mt={4}>
        Leaderboard
      </Typography>

      {loading ? (
        <Box display="flex" justifyContent="center" my={6}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Username</TableCell>
                  <TableCell>Credits</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.map((entry, index) => (
                  <TableRow key={entry.username}>
                    <TableCell>{offset + index + 1}</TableCell>
                    <TableCell>{entry.username}</TableCell>
                    <TableCell>{entry.credits}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box display="flex" justifyContent="center" mt={3}>
            <Pagination
              count={pageCount}
              page={currentPage + 1}
              onChange={(_, page) => setOffset((page - 1) * limit)}
              color="primary"
            />
          </Box>
        </>
      )}
    </Container>
  );
};

export default Leaderboard;
