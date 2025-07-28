import { useEffect, useState } from 'react'
import { RedditStockItem } from './RedditStockItem'

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

function extractPostId(input: string): string | null {
  const match = input.match(/comments\/([a-z0-9]+)/i)
  return match ? match[1] : null
}

export function RedditStocks() {
  const [filter, setFilter] = useState<'hot' | 'new' | 'subreddit' | 'default' | 'thread'>('default')
  const [subredditInput, setSubredditInput] = useState<string>('')
  const [subreddit, setSubreddit] = useState<string>('')

  const [threadIdInput, setThreadIdInput] = useState<string>('')
  const [threadId, setThreadId] = useState<string>('')

  const [posts, setPosts] = useState<RedditPost[]>([])
  const [portfolio, setPortfolio] = useState<Record<string, PortfolioItem>>({})
  const [loading, setLoading] = useState(true)

  function handleFilterChange(type: typeof filter) {
    setFilter(type)
    setPosts([])
    if (type !== 'subreddit') {
      setSubreddit('')
      setSubredditInput('')
    }
    if (type !== 'thread') {
      setThreadId('')
      setThreadIdInput('')
    }
  }

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        let mappedPosts: RedditPost[] = []

        if (filter === 'thread') {
          if (!threadId.trim()) {
            setLoading(false)
            return
          }
          const res = await fetch(`http://localhost:5000/api/reddit-post/${threadId.trim()}`)
          if (!res.ok) throw new Error('Post not found')
          const postData = await res.json()
          mappedPosts = [{
            id: postData.id,
            title: postData.title,
            score: postData.score,
            permalink: postData.permalink,
            subreddit: postData.subreddit,
            author: postData.author
          }]
        } else {
          let endpoint = 'http://localhost:5000/api/reddit-posts'
          if (filter === 'hot') endpoint += '/hot'
          else if (filter === 'new') endpoint += '/new'
          else if (filter === 'subreddit') {
            if (!subreddit.trim()) {
              setLoading(false)
              return
            }
            endpoint += `/subreddit/${subreddit.trim()}`
          }

          const postsRes = await fetch(endpoint)
          const postsData = await postsRes.json()
          mappedPosts = postsData.data.children.map((item: any) => ({
            id: item.data.id,
            title: item.data.title,
            score: item.data.score,
            permalink: item.data.permalink,
            subreddit: item.data.subreddit,
            author: item.data.author,
          }))
        }

        const portfolioRes = await fetch('http://localhost:5000/portfolio', { credentials: 'include' })
        const portfolioData: PortfolioItem[] = portfolioRes.ok ? await portfolioRes.json() : []

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
  }, [filter, subreddit, threadId])

  if (loading) return <p>Loading stocks...</p>

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">
        {filter === 'hot' ? 'Hot Reddit Stocks'
         : filter === 'new' ? 'New Reddit Stocks'
         : filter === 'subreddit' && subreddit ? `r/${subreddit} Stocks`
         : filter === 'thread' && threadId ? `Post ID: ${threadId}`
         : 'Trending Reddit Stocks'}
      </h2>

      <div className="mb-4 space-x-2">
        <button onClick={() => handleFilterChange('default')} className="btn">Trending</button>
        <button onClick={() => handleFilterChange('hot')} className="btn">Hot</button>
        <button onClick={() => handleFilterChange('new')} className="btn">New</button>
        <button onClick={() => handleFilterChange('subreddit')} className="btn">By Subreddit</button>
        <button onClick={() => handleFilterChange('thread')} className="btn">By Thread ID</button>

        {filter === 'subreddit' && (
          <>
            <input
              type="text"
              value={subredditInput}
              onChange={(e) => setSubredditInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setSubreddit(subredditInput.trim())
              }}
              placeholder="Enter subreddit"
              className="border px-2 py-1"
            />
            <button
              className="btn"
              disabled={!subredditInput.trim()}
              onClick={() => setSubreddit(subredditInput.trim())}
            >
              Search
            </button>
          </>
        )}

        {filter === 'thread' && (
          <>
            <input
              type="text"
              value={threadIdInput}
              onChange={(e) => setThreadIdInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter')
                {
                  const extracted = extractPostId(threadIdInput.trim())
                  setThreadId(extracted ?? threadIdInput.trim())                  
                }
              }}
              placeholder="Enter Reddit post ID"
              className="border px-2 py-1"
            />
            <button
              className="btn"
              disabled={!threadIdInput.trim()}
              onClick={() => 
                {
                  const extracted = extractPostId(threadIdInput.trim())
                  setThreadId(extracted ?? threadIdInput.trim())                  
                }
              }
            >
              Search
            </button>
          </>
        )}
      </div>

      {posts.map(post => {
        const owned = portfolio[post.id]
        return (
          <RedditStockItem
            key={post.id}
            post={post}
            shares={owned?.shares ?? 0}
            avgCost={owned && owned.shares > 0 ? owned.total_spent / owned.shares : 0}
          />
        )
      })}
    </div>
  )
}
