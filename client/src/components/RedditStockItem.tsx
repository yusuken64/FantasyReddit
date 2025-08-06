import React, { useMemo, useState } from "react";
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
import PriceHistoryGraph from './PriceHistoryGraph';

interface RedditPost {
  id: string;
  title: string;
  score: number;
  price: number;
  permalink: string;
  subreddit: string;
  author: string;
}

interface RedditStockItemProps {
  post: RedditPost;
  shares?: number;
  avgCost?: number;
  onDelete?: () => void;
  owned?: boolean;
}

export const RedditStockItem: React.FC<RedditStockItemProps> = ({
  post: initialPost,
  shares = 0,
  avgCost = 0,
  onDelete,
  owned = false,
}) => {
  const [lastRefreshed, setLastRefreshed] = useState(Date.now());
  const [cooldown, setCooldown] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"buy" | "sell">("buy");
  const [sharesState, setSharesState] = useState(shares);
  const [avgCostState, setAvgCostState] = useState(avgCost);
  const [post, setPost] = useState(initialPost);
  const [loading, setLoading] = useState(false);
  const { credits, userId } = useContext(AuthContext)

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
      const res = await fetch(`${import.meta.env.VITE_API_URL}/holdings/${post.id}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch holding item");
      const holdingItem = await res.json();

      if (
        holdingItem &&
        holdingItem.shares !== undefined &&
        holdingItem.total_spent !== undefined
      ) {
        setSharesState(holdingItem.shares);
        setAvgCostState(
          holdingItem.shares > 0
            ? holdingItem.total_spent / holdingItem.shares
            : 0
        );
      } else {
        setSharesState(0);
        setAvgCostState(0);
      }

      const postRes = await fetch(
        `${import.meta.env.VITE_API_URL}/api/reddit-post/${post.id}`, {
        credentials: 'include',
      }
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

  const handleDelete = async () => {
    const truncatedTitle =
      post.title.length > 15 ? post.title.slice(0, 15) + '...' : post.title;

    const confirmMsg = `Sell all ${sharesState} share${sharesState !== 1 ? 's' : ''} of "${truncatedTitle}" (${post.id}) and delete?`;
    const confirmed = window.confirm(confirmMsg);
    if (!confirmed) return;

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/holdings/${post.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to delete holding item");

      const data = await res.json();
      alert(`Sold ${data.sold} share${data.sold !== 1 ? 's' : ''} of ${post.id} at price ${data.price} with Delete`);

      if (onDelete) onDelete();
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const { start, end } = useMemo(() => {
    const now = new Date();
    now.setSeconds(0, 0);
    const end = now.toISOString();
    const start = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();
    return { start, end };
  }, []);

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
        score={post.score}
        price={post.price}
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
        <strong>r/{post.subreddit}</strong> • u/{post.author} • Score: {post.score} • Price: {post.price !== undefined ? `$${post.price.toFixed(2)}` : 'N/A'}
      </Typography>

      <Typography variant="caption" color="text.disabled" mb={2}>
        Last refreshed: {new Date(lastRefreshed).toLocaleTimeString()}
      </Typography>

      {/* Holding Info */}
      {owned && (
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
          {(() => {
            const pl = (post.price - avgCostState) * sharesState;
            const sign = pl > 0 ? '+' : pl < 0 ? '−' : '';
            const emoji = pl > 0 ? '📈' : pl < 0 ? '📉' : '⚖️';
            return (
              <Chip
                label={`${sign}$${Math.abs(pl).toFixed(2)} ${emoji}`}
                variant="outlined"
                color={pl > 0 ? 'success' : pl < 0 ? 'error' : 'default'}
              />
            );
          })()}
          {owned && (
            <Button
              size="small"
              variant="outlined"
              color="warning"
              onClick={handleDelete}
            >
              Delete
            </Button>
          )}
        </Stack>
      )}

      {(owned && userId !== null) && (
        <PriceHistoryGraph
          userId={userId}
          stockSymbol={post.id}
          start={start}
          end={end}
          latestPrice={{ timestamp: end, score: post.score }}
        />
      )}

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
