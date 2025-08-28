import React, { useMemo, useState, useContext } from "react";
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
import { AuthContext } from '../context/AuthContext'
import PriceHistoryGraph from './PriceHistoryGraph';
import { formatDistanceToNow } from 'date-fns';
import { OptionsModal } from "./OptionsModal";

interface RedditPost {
  id: string;
  title: string;
  score: number;
  price: number;
  permalink: string;
  subreddit: string;
  author: string;
  created_utc: number;
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
  const [optionModalOpen, setOptionModalOpen] = useState(false);
  //const [optionType, setOptionType] = useState<"CALL" | "PUT">("CALL");

  const { buy, sell } = useStockActions();

  const openModal = (buyMode: boolean) => {
    setModalType(buyMode ? "buy" : "sell");
    setModalOpen(true);
  };

  const openOptionModal = () => {
    //setOptionType(type);
    setOptionModalOpen(true);
  };

  const handleConfirm = async (amount: number) => {
    if (modalType === "buy") {
      await buy(post.id, amount);
    } else {
      await sell(post.id, amount);
    }

    await handleRefresh(); // ensure latest shares info
    setModalOpen(false);
  };

  const handleOptionConfirm = async (order: {
    symbol: string;
    type: "call" | "put";
    expiration: string;
    strike: number;
    premium: number;
    contracts: number;
    totalCost: number;
  }) => {
    try {
      // POST to your backend
      const res = await fetch(`${import.meta.env.VITE_API_URL}/options`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // if using cookies/session
        body: JSON.stringify({
          stockSymbol: order.symbol,
          optionType: order.type,
          strikePrice: order.strike,
          premiumPaid: order.premium,
          quantity: order.contracts,
          expiresAt: order.expiration,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }

      const data = await res.json();
      alert(`Bought ${order.contracts} contract(s) of ${order.symbol} ${order.type} at ${data.price}`);

      // Close modal
      setOptionModalOpen(false);

      // Optional: update frontend state for owned options
    } catch (err: any) {
      console.error("Error buying option:", err.message || err);
      alert(`Failed to buy option: ${err.message || err}`);
    }
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

  function getPostAge(utcSeconds: number | undefined): string {
    if (!utcSeconds || isNaN(utcSeconds) || utcSeconds <= 0) {
      return 'unknown time';
    }
    return formatDistanceToNow(new Date(utcSeconds * 1000), { addSuffix: true });
  }

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

      {/* <QuantityModal
        isOpen={optionModalOpen}
        onClose={() => setOptionModalOpen(false)}
        max={1000} // or max per your rules
        min={1}
        title={`Buy ${optionType} Option`}
        symbol={post.id}
        score={post.score}
        price={post.price} // could calculate premium instead
        type="buy"
        onConfirm={async (amount) => {
          try {
            const strikePrice = post.price; // or let user pick
            const premium = 10; // calculate premium somehow
            await fetch(`${import.meta.env.VITE_API_URL}/options`, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                stockSymbol: post.id,
                optionType,
                strikePrice,
                premiumPaid: premium,
                quantity: amount,
                expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString() // 1 day expiry
              })
            });
            alert(`${optionType} option bought!`);
          } catch (err) {
            console.error(err);
          }
        }}
      /> */}

      {optionModalOpen && (
        <OptionsModal
          isOpen={optionModalOpen}
          onClose={() => setOptionModalOpen(false)}
          onConfirm={handleOptionConfirm}
          symbol={post.id}
          maxMoney={credits ?? 0}
        />
      )}

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

      <Stack direction="row" justifyContent="space-between" mb={2}>
        <Typography variant="caption" color="text.disabled">
          Posted {getPostAge(post.created_utc)}
        </Typography>
        <Typography variant="caption" color="text.disabled">
          Last refreshed: {new Date(lastRefreshed).toLocaleTimeString()}
        </Typography>
      </Stack>
      {/* Price */}
      <Typography
        variant="subtitle2"
        color="text.secondary"
        sx={{
          width: '100px',
          textAlign: 'left',
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        ${post.price?.toFixed(2) ?? 'N/A'}
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
          <Button
            size="small"
            variant="outlined"
            color="warning"
            onClick={handleDelete}
          >
            Delete
          </Button>
        </Stack>
      )}

      {(owned && userId !== null) && (
        <PriceHistoryGraph
          userId={userId}
          stockSymbol={post.id}
          start={start}
          end={end}
          latestPrice={{ timestamp: end, price: post.price }}
          buyInPrice={avgCost}
        />
      )}

      {/* Action Buttons */}
      {owned ? (
        // Existing holding actions: Buy, Sell, Delete, P&L
        <Stack direction="row" spacing={2}>
          <Button onClick={() => openModal(true)}>Buy</Button>
          <Button onClick={() => openModal(false)} disabled={sharesState === 0}>Sell</Button>
          <Button onClick={handleDelete}>Delete</Button>
        </Stack>
      ) : (
        // Options actions: Buy Call / Put
        <Stack direction="row" spacing={2}>
          <Button onClick={() => openModal(true)}>Buy</Button>
          <Button onClick={() => openModal(false)} disabled={sharesState === 0}>Sell</Button>
          <Button onClick={() => openOptionModal()}>Options</Button>
        </Stack>
      )}
    </Paper>
  );
};
