import React, { useState } from "react"

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
  buy: (id: string) => void
  sell: (id: string) => void
  shares?: number
  avgCost?: number
  showBuy?: boolean
  onRefresh?: (id: string) => void // ← Add this to trigger refresh
}

export const RedditStockItem: React.FC<RedditStockItemProps> = ({
  post,
  buy,
  sell,
  shares = 0,
  avgCost = 0,
  onRefresh,
}) => {
  const [lastRefreshed, setLastRefreshed] = useState<number | null>(null)
  const [cooldown, setCooldown] = useState(false)

  const handleRefresh = () => {
    if (cooldown) return

    onRefresh?.(post.id)
    setLastRefreshed(Date.now())
    setCooldown(true)
    setTimeout(() => setCooldown(false), 1000)
  }

  return (
    <div className="p-4 rounded-xl shadow bg-white border">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-lg">{post.title}</h2>
        <button
          onClick={handleRefresh}
          disabled={cooldown}
          className={`text-sm px-2 py-1 rounded ${
            cooldown ? "bg-gray-300 text-gray-500" : "bg-blue-500 text-white"
          }`}
        >
          Refresh
        </button>
      </div>
      <p className="text-sm text-gray-500">
        r/{post.subreddit} • u/{post.author} • Score: {post.score}
      </p>
      <div className="mt-2 text-sm">
        <p>Shares: {shares}</p>
        <p>Avg Cost: ${avgCost.toFixed(2)}</p>
      </div>
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => buy(post.id)}
          className="px-2 py-1 bg-green-500 text-white rounded"
        >
          Buy
        </button>
        <button
          onClick={() => sell(post.id)}
          className="px-2 py-1 bg-red-500 text-white rounded"
        >
          Sell
        </button>
      </div>
    </div>
  )
}
