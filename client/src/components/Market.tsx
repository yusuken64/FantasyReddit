import { useEffect, useState } from 'react'
import Trade from './Trade'
import { useResource, credits, fresh, number, useNow } from '../data'
import { useOperations } from '../operations'
import ReadState from './ReadState'
import PriceHistory from './PriceHistory'
import { PricesExplanation } from './Explanations'
interface Post { symbol: string; title?: string; price: number | null; terminal: boolean; observed_at: string | null; stale?: boolean; status: 'ready' | 'collecting' | 'stale'; momentum: number | null }
interface Ownership { symbol: string; shares: number }
export default function Market() {
  const [symbol, setSymbol] = useState(''), [query, setQuery] = useState(''), [history, setHistory] = useState<string | null>(null)
  const [selected, setSelected] = useState<{ symbol: string; title?: string; action: 'BUY' | 'OPTION' } | null>(null)
  const market = useResource<Post[] | Post>(query ? `/market/${encodeURIComponent(query)}` : '/market')
  const ownership = useResource<Ownership[]>('/holdings')
  const { blocked } = useOperations()
  const now = useNow()
  const posts = market.data ? Array.isArray(market.data) ? market.data : [market.data] : []
  const reload = market.reload
  useEffect(() => {
    const visible = () => { if (document.visibilityState === 'visible') reload() }
    document.addEventListener('visibilitychange', visible)
    return () => document.removeEventListener('visibilitychange', visible)
  }, [reload])
  return <><h1>Reddit stocks</h1><PricesExplanation />
    <form onSubmit={e => { e.preventDefault(); if (symbol === query) market.reload(); else setQuery(symbol); setSelected(null) }}>
      <label>Reddit post ID<input value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="1abc234" pattern="[a-z0-9]{1,10}" required /></label><button>Find post</button>
    </form>
    <div className="actions"><button disabled={market.loading} onClick={() => { market.reload(); ownership.reload() }}>Refresh market</button>{query && <button onClick={() => { setQuery(''); setSelected(null) }}>Back to hot posts</button>}</div>
    <ReadState {...market} hasData={market.data !== undefined} />
    {ownership.error && <div role="alert">Ownership could not be refreshed; share counts may be out of date. <button onClick={ownership.reload}>Retry ownership</button></div>}
    {selected && <Trade key={`${selected.symbol}:${selected.action}`} {...selected} onDone={() => setSelected(null)} />}
    {market.data && !posts.length && <p>No posts in this result. Refresh or find a post by ID.</p>}
    {posts.map(post => {
      const ready = post.status === 'ready' && fresh(post, now) && !post.terminal && !market.error
      const held = ownership.data?.find(row => row.symbol === post.symbol)?.shares ?? 0
      return <article key={post.symbol}><h2>{post.title || post.symbol}</h2><a href={`https://www.reddit.com/comments/${post.symbol}`} target="_blank" rel="noreferrer">View Reddit post</a>
        <p>{post.price === null ? 'No measured price yet' : credits(post.price)} · {post.terminal ? 'Removed — terminal price zero' : post.status === 'collecting' ? 'Collecting momentum — allow at least five minutes, then refresh' : !ready ? 'Stale price — refresh to check for a measured observation' : `Observed ${new Date(post.observed_at!).toLocaleString()}`}</p>
        <p>{ownership.data === undefined ? 'Ownership unavailable' : `Owned: ${number(held)} shares${ownership.error ? ' (may be out of date)' : ''}`}</p>
        {post.momentum !== null && <p>Score growth: {post.momentum.toFixed(2)} points/minute</p>}
        <div className="actions"><button disabled={!ready || blocked} onClick={() => setSelected({ symbol: post.symbol, title: post.title, action: 'BUY' })}>Buy shares</button>
          <button disabled={!ready || blocked} onClick={() => setSelected({ symbol: post.symbol, title: post.title, action: 'OPTION' })}>Buy option</button>
          <button aria-expanded={history === post.symbol} onClick={() => setHistory(history === post.symbol ? null : post.symbol)}>Price history</button></div>
        {history === post.symbol && <PriceHistory symbol={post.symbol} />}
      </article>
    })}
  </>
}
