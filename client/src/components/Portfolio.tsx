import React, { useEffect, useState } from "react"
import { RedditStockItem } from './RedditStockItem'

type PortfolioItem = {
  id: number
  user_id: number
  stock_symbol: string
  shares: number
  total_spent: number
}

type RedditPost = {
  id: string
  title: string
  score: number
  permalink: string
  subreddit: string
  author: string
}

const Portfolio: React.FC = () => {
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([])
  const [loading, setLoading] = useState(true)
  // Keep posts fetched for each stock_symbol to pass to RedditStockItem
  const [postsMap, setPostsMap] = useState<Record<string, RedditPost>>({})

  // Fetch portfolio on mount
  useEffect(() => {
    fetchPortfolio()
  }, [])

  async function getPost(stock_symbol: string): Promise<RedditPost | null> {
    try {
      const res = await fetch(`http://localhost:5000/api/reddit-post/${stock_symbol}`)
      if (!res.ok) throw new Error(`Post not found for id ${stock_symbol}`)
      const postData = await res.json()
      return postData
    } catch (err) {
      console.error(err)
      return null
    }
  }

  async function fetchPortfolio() {
    try {
      const res = await fetch("http://localhost:5000/portfolio", {
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to fetch portfolio")
      const data: PortfolioItem[] = await res.json()
      setPortfolio(data)

      // Fetch posts for each stock_symbol to display details in RedditStockItem
      const postsFetched: Record<string, RedditPost> = {}
      await Promise.all(
        data.map(async (item) => {
          const post = await getPost(item.stock_symbol)
          if (post) postsFetched[item.stock_symbol] = post
        })
      )
      setPostsMap(postsFetched)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <p>Loading your portfolio...</p>

  if (portfolio.length === 0) return <p>You don't own any Reddit stocks yet.</p>

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Your Portfolio</h1>
      <ul className="space-y-4">
        {portfolio.map((item) => {
          const post = postsMap[item.stock_symbol]
          if (!post) return null

          const avgCost = item.shares > 0 ? item.total_spent / item.shares : 0

          return (
            <li key={item.stock_symbol}>
              <RedditStockItem
                post={post}
                shares={item.shares}
                avgCost={avgCost}
                showBuy={true}
              />
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default Portfolio
