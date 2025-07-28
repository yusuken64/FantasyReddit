import React, { useEffect, useState, useContext } from "react"
import { AuthContext } from '../context/AuthContext'
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
  const [posts, setPosts] = useState<Record<string, RedditPost>>({})
  const [loading, setLoading] = useState(true)
  const { updateCredits } = useContext(AuthContext)

  // Fetch portfolio on mount
  useEffect(() => {
    fetchPortfolio()
  }, [])

  // Fetch Reddit posts on mount
  useEffect(() => {
    fetchPosts()
  }, [])

  async function fetchPortfolio() {
    try {
      const res = await fetch("http://localhost:5000/portfolio", {
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to fetch portfolio")
      const data = await res.json()
      setPortfolio(data)
    } catch (err) {
      console.error(err)
    }
  }

  async function fetchPosts() {
    try {
      const res = await fetch("http://localhost:5000/api/reddit-posts")
      const data = await res.json()
      const mappedPosts = data.data.children.reduce(
        (acc: Record<string, RedditPost>, item: any) => {
          const p = item.data
          acc[p.id] = {
            id: p.id,
            title: p.title,
            score: p.score,
            permalink: p.permalink,
            subreddit: p.subreddit,
            author: p.author,
          }
          return acc
        },
        {}
      )
      setPosts(mappedPosts)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSell(symbol: string) {
    try {
      const res = await fetch("http://localhost:5000/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ symbol, quantity: 1 }),
      })
      if (!res.ok) throw new Error("Failed to sell stock")
      await fetchPortfolio()
      await updateCredits()
    } catch (err) {
      alert("Error selling stock")
      console.error(err)
    }
  }

  async function handleBuy(symbol: string) {
    try {
      const res = await fetch("http://localhost:5000/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ symbol, quantity: 1 }),
      })
      if (!res.ok) throw new Error("Failed to buy stock")
      await fetchPortfolio()
      await updateCredits()
    } catch (err) {
      alert("Error buying stock")
      console.error(err)
    }
  }

  async function refreshPost(id: string) {
    try {
      const res = await fetch(`http://localhost:5000/api/reddit-post/${id}`)
      if (!res.ok) throw new Error('Failed to fetch single post')
      const updatedPost: RedditPost = await res.json()
  
      setPosts((prev) => ({
        ...prev,
        [id]: updatedPost,
      }))
    } catch (err) {
      console.error('Error refreshing post:', err)
    }
  }

  if (loading) return <p>Loading your portfolio...</p>

  if (portfolio.length === 0) return <p>You don't own any Reddit stocks yet.</p>

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">📈 Your Portfolio</h1>
      <ul className="space-y-4">
        {portfolio.map((item) => {
          const post = posts[item.stock_symbol]
          if (!post) return null

          const avgCost = item.shares > 0 ? item.total_spent / item.shares : 0

          return (
            <li key={item.stock_symbol}>
              <RedditStockItem
                post={post}
                buy={handleBuy}
                sell={handleSell}
                shares={item.shares}
                avgCost={avgCost}
                showBuy={true}
                onRefresh={() => refreshPost(item.stock_symbol)}
              />
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default Portfolio
