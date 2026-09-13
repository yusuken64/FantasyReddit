import { useEffect, useState } from 'react'
import { api, message } from '../api'
import Trade from './Trade'
interface Post { symbol: string; title?: string; price: number; terminal: boolean; observed_at: string; stale?: boolean }
export default function Market() {
  const [posts, setPosts] = useState<Post[]>([]), [error, setError] = useState(''), [symbol, setSymbol] = useState(''), [selected, setSelected] = useState<{ symbol: string; action: 'BUY' | 'OPTION' } | null>(null)
  useEffect(() => { let active = true; api<Post[]>('/market').then(rows => { if (active) setPosts(rows) }).catch(e => { if (active) setError(message(e)) }); return () => { active = false } }, [])
  async function search() { try { const post = await api<Post>(`/market/${encodeURIComponent(symbol)}`); setPosts([post]); setError('') } catch (e) { setError(message(e)) } }
  return <><h1>Reddit stocks</h1><form onSubmit={e => { e.preventDefault(); void search() }}><label>Reddit post ID<input value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="1abc234" pattern="[a-z0-9]{1,10}" required /></label><button>Find post</button></form>
    {error && <p role="alert">{error}</p>}{selected && <Trade key={`${selected.symbol}:${selected.action}`} {...selected} onDone={() => setSelected(null)} />}
    {posts.map(post => <article key={post.symbol}><h2>{post.title || post.symbol}</h2><a href={`https://www.reddit.com/comments/${post.symbol}`} target="_blank" rel="noreferrer">View Reddit post</a><p>{post.price} credits · {post.terminal ? 'Removed — terminal price zero' : post.stale ? 'Stale price — orders require fresh data' : `Observed ${new Date(post.observed_at).toLocaleString()}`}</p><button disabled={post.terminal} onClick={() => setSelected({ symbol: post.symbol, action: 'BUY' })}>Buy shares</button> <button disabled={post.terminal} onClick={() => setSelected({ symbol: post.symbol, action: 'OPTION' })}>Buy option</button></article>)}
  </>
}
