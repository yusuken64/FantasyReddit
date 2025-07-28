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
  const [postsMap, setPostsMap] = useState<Record<string, RedditPost>>({})
  const [sortBy, setSortBy] = useState<'shares' | 'total_spent'>('shares')
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('ASC')
  const [page, setPage] = useState(1)
  const limit = 5
  const [] = useState(0)

  // Fetch portfolio on mount
  useEffect(() => {
    fetchPortfolio()
  }, [sortBy, sortDir, page])

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
      const offset = (page - 1) * limit

      const res = await fetch(
        `http://localhost:5000/portfolio?sortBy=${sortBy}&sortDir=${sortDir}&limit=${limit}&offset=${offset}`,
        { credentials: "include" }
      )
      if (!res.ok) throw new Error("Failed to fetch portfolio")
      const json = await res.json();
      const portfolioData: PortfolioItem[] = json.data;
      setPortfolio(portfolioData)

      // Fetch posts for each stock_symbol to display details in RedditStockItem
      const postsFetched: Record<string, RedditPost> = {}
      await Promise.all(
        portfolioData.map(async (item) => {
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

      <div className="mb-6 flex items-center space-x-4">
        <label>
          Sort By:&nbsp;
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="border rounded px-2 py-1"
          >
            {/* <option value="stock_symbol">Stock Symbol</option> */}
            <option value="shares">Shares</option>
            <option value="total_spent">Total Spent</option>
          </select>
        </label>
        <button
          onClick={() => setSortDir(sortDir === 'ASC' ? 'DESC' : 'ASC')}
          className="border rounded px-3 py-1"
          aria-label="Toggle sort direction"
        >
          {sortDir === 'ASC' ? 'Ascending ↑' : 'Descending ↓'}
        </button>
      </div>

      <div className="flex justify-between mt-6">
        <button
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          Previous
        </button>
        <button
          disabled={portfolio.length < limit}
          onClick={() => setPage(page + 1)}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          Next
        </button>
      </div>
      {portfolio.map((item) => {
        const post = postsMap[item.stock_symbol]
        if (!post) return null

        const avgCost = item.shares > 0 ? item.total_spent / item.shares : 0

        return (
          <RedditStockItem
            post={post}
            shares={item.shares}
            avgCost={avgCost}
            showBuy={true}
          />
        )
      })}

      <div className="flex justify-between mt-6">
        <button
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          Previous
        </button>
        <button
          disabled={portfolio.length < limit}
          onClick={() => setPage(page + 1)}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  )
}

export default Portfolio
