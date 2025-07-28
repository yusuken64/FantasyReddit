import { useEffect, useState } from 'react'
import { RedditStockItem } from './RedditStockItem'
import { useStockActions } from '../hooks/useStockActions'

interface RedditPost {
  id: string
  title: string
  score: number
  permalink: string
  subreddit: string
  author: string
  shares?: number
  total_spent?: number
}

interface PortfolioItem {
  stock_symbol: string
  shares: number
  total_spent: number
}

export function RedditStocks() {
  const [posts, setPosts] = useState<RedditPost[]>([])
  const [portfolio, setPortfolio] = useState<Record<string, PortfolioItem>>({})
  const [loading, setLoading] = useState(true)
  const { buy, sell } = useStockActions()

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        // Fetch Reddit posts
        const postsRes = await fetch('http://localhost:5000/api/reddit-posts')
        const postsData = await postsRes.json()
        const mappedPosts: RedditPost[] = postsData.data.children.map((item: any) => ({
          id: item.data.id,
          title: item.data.title,
          score: item.data.score,
          permalink: item.data.permalink,
          subreddit: item.data.subreddit,
          author: item.data.author,
        }))

        // Fetch user's portfolio
        const portfolioRes = await fetch('http://localhost:5000/portfolio', { credentials: 'include' })
        const portfolioData: PortfolioItem[] = portfolioRes.ok ? await portfolioRes.json() : []

        // Convert portfolio array to a map by stock_symbol for quick lookup
        const portfolioMap: Record<string, PortfolioItem> = {}
        for (const item of portfolioData) {
          portfolioMap[item.stock_symbol] = item
        }

        setPosts(mappedPosts)
        setPortfolio(portfolioMap)
      } catch (err) {
        console.error('Failed to load stocks or portfolio', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) return <p>Loading stocks...</p>

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Trending Reddit Stocks</h2>
      {posts.map(post => {
        const owned = portfolio[post.id]
        return (
          <RedditStockItem
            key={post.id}
            post={post}
            buy={buy}
            sell={sell}
            shares={owned?.shares ?? 0}
            avgCost={owned && owned.shares > 0 ? owned.total_spent / owned.shares : 0}
          />
        )
      })}
    </div>
  )
}
