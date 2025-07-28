import React, { useState } from "react";
import { useStockActions } from "../hooks/useStockActions";
import { QuantityModal } from "./QuantityModal";

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
  showBuy?: boolean;
}

export const RedditStockItem: React.FC<RedditStockItemProps> = ({
  post: initialPost,
  shares = 0,
  avgCost = 0,
}) => {
  const [lastRefreshed, setLastRefreshed] = useState(Date.now());
  const [cooldown, setCooldown] = useState(false);
  const [isBuying, setIsBuying] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"buy" | "sell">("buy");
  const [sharesState, setSharesState] = useState(shares);
  const [avgCostState, setAvgCostState] = useState(avgCost);
  const [post, setPost] = useState(initialPost);
  const [loading, setLoading] = useState(false);

  const { buy, sell } = useStockActions();

  const openModal = (buyMode: boolean) => {
    setIsBuying(buyMode);
    setModalType(buyMode ? "buy" : "sell");
    setModalOpen(true);
  };

  const handleConfirm = (amount: number) => {
    isBuying ? buy(post.id, amount) : sell(post.id, amount);
    handleRefresh();
    setModalOpen(false);
  };

  const handleRefresh = async () => {
    if (cooldown) return;
    setLoading(true);

    try {
      const res = await fetch(`http://localhost:5000/portfolio/${post.id}`, {
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

      const postRes = await fetch(`http://localhost:5000/api/reddit-post/${post.id}`);
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
    <div className="p-5 rounded-xl shadow-md bg-white border border-gray-300 hover:border-blue-500 transition duration-200 space-y-3">

      <QuantityModal
        isOpen={modalOpen}
        onClose={() => {
          handleRefresh();
          setModalOpen(false);
        }}
        max={isBuying ? 1000000 : shares}
        min={0}
        initialAmount={1}
        title={isBuying ? "Buy Shares" : "Sell Shares"}
        onConfirm={handleConfirm}
        symbol={post.id}
        cost={post.score}
        type={modalType}
      />

      {/* Header */}
      <div className="flex justify-between items-center">
        <a
          href={`https://reddit.com${post.permalink}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-blue-600 text-lg hover:underline flex-1"
        >
          {post.title}
        </a>

        <button
          onClick={handleRefresh}
          disabled={cooldown || loading}
          className={`ml-4 flex items-center gap-1 text-sm px-3 py-1 rounded-md transition ${
            cooldown || loading
              ? "bg-gray-200 text-gray-500 cursor-not-allowed"
              : "bg-blue-500 text-white hover:bg-blue-600"
          }`}
        >
          {loading ? (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          ) : (
            "Refresh"
          )}
        </button>
      </div>

      <p className="text-sm text-gray-600">
        <span className="font-medium">r/{post.subreddit}</span> • u/{post.author} •{" "}
        <span className="text-gray-500">Score: {post.score}</span>
      </p>

      <p className="text-xs text-gray-400">
        Last refreshed: {new Date(lastRefreshed).toLocaleTimeString()}
      </p>

      {/* Portfolio Info */}
      <div className="flex gap-4 items-center text-sm">
        <span className="px-2 py-1 bg-gray-100 border border-gray-300 rounded">
          Shares: <strong>{sharesState}</strong>
        </span>
        <span className="px-2 py-1 bg-gray-100 border border-gray-300 rounded">
          Avg Cost: <strong>${avgCostState.toFixed(2)}</strong>
        </span>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => openModal(true)}
          className="flex-1 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition"
        >
          Buy
        </button>
        <button
          onClick={() => openModal(false)}
          className={`flex-1 px-4 py-2 rounded-md transition ${
            sharesState === 0
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-red-500 text-white hover:bg-red-600"
          }`}
          disabled={sharesState === 0}
        >
          Sell
        </button>
      </div>
    </div>
  );
};
