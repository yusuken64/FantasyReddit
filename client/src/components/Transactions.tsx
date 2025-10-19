import React, { useEffect, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  Button,
  Box,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  IconButton,
  Link,
} from '@mui/material'
import { ArrowUpward, ArrowDownward } from '@mui/icons-material'

type Transaction = {
  id: number
  user_id: number
  stock_symbol: string
  shares: number
  price_per_share: number
  action: 'BUY' | 'SELL'
  timestamp: string
}

const Transactions: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState<'timestamp' | 'stock_symbol' | 'action'>(
    'timestamp'
  )
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('DESC')
  const [filterAction, setFilterAction] = useState<'ALL' | 'BUY' | 'SELL'>('ALL')
  const limit = 10

  useEffect(() => {
    fetchTransactions()
  }, [page, sortBy, sortDir, filterAction])

  async function fetchTransactions() {
    try {
      setLoading(true)
      const offset = (page - 1) * limit
      // Pass filterAction as 'action' param if not 'ALL'
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
        sortBy,
        sortDir,
      })
      if (filterAction !== 'ALL') {
        params.append('action', filterAction)
      }

      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/transactions?${params.toString()}`,
        {
          credentials: 'include',
        }
      )
      if (!res.ok) throw new Error('Failed to fetch transactions')
      const data = await res.json()
      setTransactions(data.transactions ?? [])
    } catch (err) {
      console.error(err)
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }

  const toggleSortDir = () => {
    setSortDir((d) => (d === 'ASC' ? 'DESC' : 'ASC'))
  }

  function RedditLink({ postId }: { postId: string }) {
    const url = `https://reddit.com/comments/${postId}`
    return (
      <Link href={url} target="_blank" rel="noopener noreferrer">
        {postId}
      </Link>
    )
  }


  if (loading)
    return (
      <Box textAlign="center" mt={4}>
        <CircularProgress />
        <Typography mt={2}>Loading transaction history...</Typography>
      </Box>
    )

  if (transactions.length === 0)
    return (
      <Typography mt={4} variant="h6" align="center">
        You haven't made any transactions yet.
      </Typography>
    )

  return (
    <Box maxWidth={800} mx="auto" p={2}>
      <Typography variant="h4" mb={3} align="center">
        Transaction History
      </Typography>

      {/* Filters */}
      <Stack
        direction="row"
        spacing={2}
        justifyContent="center"
        alignItems="center"
        mb={2}
        flexWrap="wrap"
      >
        {/* Filter Buttons: All / Buy / Sell */}
        <Stack direction="row" spacing={1}>
          {(['ALL', 'BUY', 'SELL'] as const).map((action) => (
            <Button
              key={action}
              variant={filterAction === action ? 'contained' : 'outlined'}
              color={
                action === 'BUY'
                  ? 'success'
                  : action === 'SELL'
                    ? 'error'
                    : 'primary'
              }
              onClick={() => {
                setPage(1) // reset page when filter changes
                setFilterAction(action)
              }}
            >
              {action}
            </Button>
          ))}
        </Stack>

        {/* Sort By Select */}
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel id="sort-by-label">Sort By</InputLabel>
          <Select
            labelId="sort-by-label"
            value={sortBy}
            label="Sort By"
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          >
            <MenuItem value="timestamp">Date</MenuItem>
            <MenuItem value="stock_symbol">Stock</MenuItem>
            <MenuItem value="action">Type</MenuItem>
          </Select>
        </FormControl>

        {/* Sort Direction Toggle */}
        <IconButton onClick={toggleSortDir} aria-label="Toggle sort direction">
          {sortDir === 'ASC' ? <ArrowUpward /> : <ArrowDownward />}
        </IconButton>
      </Stack>

      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Date</TableCell>
            <TableCell>Stock</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>Shares</TableCell>
            <TableCell>Price/Share</TableCell>
            <TableCell>Total</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {transactions.map((tx) => {
            const total = tx.price_per_share * tx.shares
            const isBuy = tx.action === 'BUY'

            return (
              <TableRow
                key={tx.id}
                sx={{
                  bgcolor: isBuy ? 'success.light' : 'error.light',
                  cursor: 'default',
                }}
              >
                <TableCell>{new Date(tx.timestamp).toLocaleString()}</TableCell>
                <TableCell><RedditLink postId={tx.stock_symbol} /></TableCell>
                <TableCell>
                  <Typography
                    fontWeight="bold"
                    color={isBuy ? 'success.main' : 'error.main'}
                  >
                    {tx.action}
                  </Typography>
                </TableCell>
                <TableCell>{tx.shares}</TableCell>
                <TableCell>${Number(tx.price_per_share).toFixed(2)}</TableCell>
                <TableCell>${total.toFixed(2)}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <Box mt={3} display="flex" justifyContent="space-between">
        <Button
          variant="outlined"
          disabled={page === 1}
          onClick={() => setPage((p) => Math.max(p - 1, 1))}
        >
          Previous
        </Button>
        <Button
          variant="outlined"
          disabled={transactions.length < limit}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </Box>
    </Box>
  )
}

export default Transactions
