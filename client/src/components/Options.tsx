import React, { useEffect, useState } from "react";
import { Paper, Stack, Typography, Button } from "@mui/material";

type OptionItem = {
  id: number;
  user_id: number;
  stock_symbol: string;
  option_type: "CALL" | "PUT";
  strike_price: number;
  premium_paid: number;
  quantity: number;
  expires_at: string;
};

type RedditPost = {
  id: string;
  title: string;
  score: number;
  price: number;
  permalink: string;
  subreddit: string;
  author: string;
  created_utc: number;
};

const Options: React.FC = () => {
  const [options, setOptions] = useState<OptionItem[]>([]);
  const [postsMap, setPostsMap] = useState<Record<string, RedditPost>>({});
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"expires_at" | "premium_paid">("expires_at");
  const [sortDir, setSortDir] = useState<"ASC" | "DESC">("ASC");
  const [page, setPage] = useState(1);
  const limit = 5;

  useEffect(() => {
    fetchOptions();
  }, [sortBy, sortDir, page]);

  async function fetchOptions() {
    setLoading(true);
    try {
      const offset = (page - 1) * limit;
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/options?sortBy=${sortBy}&sortDir=${sortDir}&limit=${limit}&offset=${offset}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch options");

      const json = await res.json();
      setOptions(json)

      // Fetch posts for each stock_symbol
      const postsFetched: Record<string, RedditPost> = {};
      await Promise.all(
        json.map(async (opt: OptionItem) => {
          const postRes = await fetch(
            `${import.meta.env.VITE_API_URL}/api/reddit-post/${opt.stock_symbol}`,
            { credentials: "include" }
          );
          if (postRes.ok) {
            postsFetched[opt.stock_symbol] = await postRes.json();
          }
        })
      );
      setPostsMap(postsFetched);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleExercise = async (optionId: number) => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/options/${optionId}/exercise`,
        { method: "POST", credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to exercise option");
      // Refresh options after exercise
      fetchOptions();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <p>Loading your options...</p>;
  if (options.length === 0) return <p>You have no active options.</p>;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <Stack direction="row" spacing={2} mb={2}>
        <Typography>Sort By:</Typography>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="border rounded px-2 py-1"
        >
          <option value="expires_at">Expiry</option>
          <option value="premium_paid">Premium Paid</option>
        </select>
        <Button
          variant="outlined"
          onClick={() => setSortDir(sortDir === "ASC" ? "DESC" : "ASC")}
        >
          {sortDir === "ASC" ? "Ascending ↑" : "Descending ↓"}
        </Button>
      </Stack>

      {options.map((opt) => {
        const post = postsMap[opt.stock_symbol];
        if (!post) return null;

        return (
          <Paper
            key={opt.id}
            elevation={3}
            sx={{ p: 2, mb: 2, borderRadius: 2, border: "1px solid #ccc" }}
          >
            <Stack spacing={1}>
              <Typography variant="h6">{post.title}</Typography>
              <Typography variant="body2" color="text.secondary">
                Symbol: {opt.stock_symbol} | Type: {opt.option_type} | Strike: {opt.strike_price} | Premium Paid: {opt.premium_paid} | Quantity: {opt.quantity} | Expires:{" "}
                {new Date(opt.expires_at).toLocaleString()}
              </Typography>

              <Stack direction="row" spacing={2}>
                <Button
                  variant="contained"
                  color="success"
                  onClick={() => handleExercise(opt.id)}
                >
                  Exercise
                </Button>
                <Button
                  variant="outlined"
                  component="a"
                  href={`https://reddit.com${post.permalink}`}
                  target="_blank"
                >
                  View Post
                </Button>
              </Stack>
            </Stack>
          </Paper>
        );
      })}

      <Stack direction="row" justifyContent="space-between" mt={2}>
        <Button
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
          variant="outlined"
        >
          Previous
        </Button>
        <Button
          disabled={options.length < limit}
          onClick={() => setPage(page + 1)}
          variant="outlined"
        >
          Next
        </Button>
      </Stack>
    </div>
  );
}

export default Options;
