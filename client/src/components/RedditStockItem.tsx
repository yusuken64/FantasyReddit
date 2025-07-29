import React, { useState } from "react";
import { useStockActions } from "../hooks/useStockActions";
import { QuantityModal } from "./QuantityModal";
import {
  Typography,
  Link,
  Button,
  Paper,
  CircularProgress,
  Stack,
  Chip,
} from "@mui/material";
import { useContext } from 'react'
import { AuthContext } from '../context/AuthContext'

interface RedditPost {
  id: string;
  title: string;
  score: number;
  permalink: string;
  subreddit: string;
  author: string;
}

interface RedditStockItemProps {
  post: RedditPost;
  shares?: number;
  avgCost?: number;
}

export const RedditStockItem: React.FC<RedditStockItemProps> = ({
  post: initialPost,
  shares = 0,
  avgCost = 0,
}) => {
  const [lastRefreshed, setLastRefreshed] = useState(Date.now());
  const [cooldown, setCooldown] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"buy" | "sell">("buy");
  const [sharesState, setSharesState] = useState(shares);
  const [avgCostState, setAvgCostState] = useState(avgCost);
  const [post, setPost] = useState(initialPost);
  const [loading, setLoading] = useState(false);
  const {credits} = useContext(AuthContext)

  const { buy, sell } = useStockActions();

  const openModal = (buyMode: boolean) => {
    setModalType(buyMode ? "buy" : "sell");
    setModalOpen(true);
  };

  const handleConfirm = (amount: number) => {
    modalType === "buy" ? buy(post.id, amount) : sell(post.id, amount);
    handleRefresh();
    setModalOpen(false);
  };

  const handleRefresh = async () => {
    if (cooldown) return;
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/portfolio/${post.id}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch portfolio item");
      const portfolioItem = await res.json();

      if (
        portfolioItem &&
        portfolioItem.shares !== undefined &&
        portfolioItem.total_spent !== undefined
      ) {
        setSharesState(portfolioItem.shares);
        setAvgCostState(
          portfolioItem.shares > 0
            ? portfolioItem.total_spent / portfolioItem.shares
            : 0
        );
      } else {
        setSharesState(0);
        setAvgCostState(0);
      }

      const postRes = await fetch(
        `http://localhost:5000/api/reddit-post/${post.id}`
      );
      if (postRes.ok) {
        const updatedPost = await postRes.json();
        setPost(updatedPost);
      }
    } catch (err) {
      console.error("Refresh error:", err);
      setSharesState(0);
      setAvgCostState(0);
    } finally {
      setLastRefreshed(Date.now());
      setCooldown(true);
      setTimeout(() => setCooldown(false), 1000);
      setLoading(false);
    }
  };

  return (
    <Paper
      elevation={3}
      sx={{ p: 3, borderRadius: 2, border: "1px solid #ccc", mb: 2 }}
    >
      <QuantityModal
        isOpen={modalOpen}
        onClose={() => {
          handleRefresh();
          setModalOpen(false);
        }}
        max={modalType === "buy" ? 1000000 : sharesState}
        min={0}
        initialAmount={1}
        title={modalType === "buy" ? "Buy Shares" : "Sell Shares"}
        onConfirm={handleConfirm}
        symbol={post.id}
        cost={post.score}
        type={modalType}
        maxMoney={modalType === "buy" ? credits || 0 : undefined}
      />

      {/* Header */}
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        spacing={2}
        mb={1}
      >
        <Link
          href={`https://reddit.com${post.permalink}`}
          target="_blank"
          rel="noopener noreferrer"
          underline="hover"
          variant="h6"
          sx={{ flexGrow: 1 }}
        >
          {post.title}
        </Link>

        <Button
          variant="contained"
          color="primary"
          onClick={handleRefresh}
          disabled={cooldown || loading}
          startIcon={
            loading ? (
              <CircularProgress size={16} color="inherit" />
            ) : undefined
          }
        >
          Refresh
        </Button>
      </Stack>

      <Typography variant="body2" color="text.secondary" mb={0.5}>
        <strong>r/{post.subreddit}</strong> • u/{post.author} • Score: {post.score}
      </Typography>

      <Typography variant="caption" color="text.disabled" mb={2}>
        Last refreshed: {new Date(lastRefreshed).toLocaleTimeString()}
      </Typography>

      {/* Portfolio Info */}
      <Stack direction="row" spacing={2} mb={2}>
        <Chip
          label={`Shares: ${sharesState}`}
          variant="outlined"
          color="default"
        />
        <Chip
          label={`Avg Cost: $${avgCostState.toFixed(2)}`}
          variant="outlined"
          color="default"
        />
      </Stack>

      {/* Action Buttons */}
      <Stack direction="row" spacing={2}>
        <Button
          fullWidth
          variant="contained"
          color="success"
          onClick={() => openModal(true)}
        >
          Buy
        </Button>
        <Button
          fullWidth
          variant="contained"
          color="error"
          onClick={() => openModal(false)}
          disabled={sharesState === 0}
        >
          Sell
        </Button>
      </Stack>
    </Paper>
  );
};
