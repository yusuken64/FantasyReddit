import React, { useState } from "react"
import { useStockActions } from "../hooks/useStockActions"
import { QuantityModal } from "./QuantityModal"

interface RedditPost {
  id: string
  title: string
  score: number
  permalink: string
  subreddit: string
  author: string
}

interface RedditStockItemProps {
  post: RedditPost
  shares?: number
  avgCost?: number
  showBuy?: boolean
}

export const RedditStockItem: React.FC<RedditStockItemProps> = ({
  post: initialPost,
  shares = 0,
  avgCost = 0,
}) => {
  const [lastRefreshed, setLastRefreshed] = useState(Date.now())
  const [cooldown, setCooldown] = useState(false)
  const { buy, sell } = useStockActions()
  const [isBuying, setIsBuying] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState<"buy" | "sell">("buy");
  const [sharesState, setSharesState] = useState(shares)
  const [avgCostState, setAvgCostState] = useState(avgCost)
  const [post, setPost] = useState(initialPost)
  const [loading, setLoading] = useState(false);

  const openModal = (buyMode: boolean) => {
    setIsBuying(buyMode)
    setModalOpen(true)
  }

  const handleConfirm = (amount: number) => {
    if (isBuying) {
      buy(post.id, amount);
    } else {
      sell(post.id, amount);
    }

    handleRefresh();
    setModalOpen(false);
  }

  const handleRefresh = async () => {
    if (cooldown) return;

    setLoading(true);

    try {
      // Fetch portfolio data for this stock symbol (post.id)
      const res = await fetch(`http://localhost:5000/portfolio/${post.id}`, {
        credentials: 'include',
      });

      if (!res.ok) {
        console.error('Failed to fetch portfolio item');
        // Optionally clear state if fetch fails
        setSharesState(0);
        setAvgCostState(0);
        setLoading(false);
        return;
      }

      const portfolioItem = await res.json();

      // portfolioItem might be {} or null if no data found
      if (portfolioItem && portfolioItem.shares !== undefined && portfolioItem.total_spent !== undefined) {
        setSharesState(portfolioItem.shares);
        setAvgCostState(
          portfolioItem.shares > 0
            ? portfolioItem.total_spent / portfolioItem.shares
            : 0
        );
      } else {
        // No portfolio data found - reset state or keep existing?
        setSharesState(0);
        setAvgCostState(0);
      }

      // Fetch updated Reddit post data
      const postRes = await fetch(`http://localhost:5000/api/reddit-post/${post.id}`);
      if (postRes.ok) {
        const updatedPost = await postRes.json();
        setPost(updatedPost);
      } else {
        console.error('Failed to fetch Reddit post');
      }
    } catch (error) {
      console.error('Error refreshing portfolio item:', error);
    } finally {
      setLastRefreshed(Date.now());
      setCooldown(true);
      setTimeout(() => setCooldown(false), 1000);
      setLoading(false);
    }
  };


  return (
    <div className="p-4 rounded-2xl shadow-lg bg-gray-50 border-2 border-gray-300 hover:border-blue-500 transition duration-200">

      <QuantityModal
        isOpen={modalOpen}
        onClose={() => 
        {
          handleRefresh()
          setModalOpen(false)}
        }
        max={isBuying ? 1000000 : shares}
        min={0}
        initialAmount={1}
        title={isBuying ? "Buy Shares" : "Sell Shares"}
        onConfirm={handleConfirm}
        symbol={post.id}
        cost={post.score}
        type={modalType}
      />
      <div className="flex justify-between items-center">
        <a
          href={`https://reddit.com${post.permalink}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-lg text-blue-700 hover:underline"
        >
          {post.title}
        </a>
        <button
          onClick={handleRefresh}
          disabled={cooldown || loading}
          className={`text-sm px-2 py-1 rounded ${cooldown || loading
            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
            : "bg-blue-500 text-white"
            }`}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <p className="text-sm text-gray-500">
        r/{post.subreddit} • u/{post.author} • Score: {post.score}
      </p>

      {lastRefreshed && (
        <p className="text-xs text-gray-400 mt-1">
          Last refreshed: {new Date(lastRefreshed).toLocaleTimeString()}
        </p>
      )}

      <div className="mt-2 text-sm">
        <p>Shares: {sharesState}</p>
        <p>Avg Cost: ${avgCostState.toFixed(2)}</p>
      </div>

      <div className="mt-2 flex gap-2">
        <button
          onClick={() => 
          {
            setModalType("buy");
            openModal(true)}
          }
          className="px-2 py-1 bg-green-500 text-white rounded"
        >
          Buy
        </button>
        <button
          onClick={() => 
            {
            setModalType("sell");
              openModal(false)}
            }
          className="px-2 py-1 bg-red-500 text-white rounded"
          disabled={sharesState === 0}
        >
          Sell
        </button>
      </div>
    </div>
  )
}
