import { useEffect, useState } from 'react'
import { api, message } from '../api'
import Trade from './Trade'
interface Post { symbol: string; title?: string; price: number | null; terminal: boolean; observed_at: string | null; stale?: boolean; status: 'ready' | 'collecting' | 'stale'; momentum: number | null }
export default function Market() {
  const [posts, setPosts] = useState<Post[]>([]), [error, setError] = useState(''), [symbol, setSymbol] = useState(''), [selected, setSelected] = useState<{ symbol: string; action: 'BUY' | 'OPTION' } | null>(null)
  useEffect(() => { let active = true; api<Post[]>('/market').then(rows => { if (active) setPosts(rows) }).catch(e => { if (active) setError(message(e)) }); return () => { active = false } }, [])
  async function search() { try { const post = await api<Post>(`/market/${encodeURIComponent(symbol)}`); setPosts([post]); setError('') } catch (e) { setError(message(e)) } }
  return <><h1>Reddit stocks</h1><form onSubmit={e => { e.preventDefault(); void search() }}><label>Reddit post ID<input value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="1abc234" pattern="[a-z0-9]{1,10}" required /></label><button>Find post</button></form>
    {error && <p role="alert">{error}</p>}{selected && <Trade key={`${selected.symbol}:${selected.action}`} {...selected} onDone={() => setSelected(null)} />}
    <p>Prices follow score growth over a trailing 15-minute window. New posts need a five-minute measured interval before trading.</p>
    {posts.map(post => <article key={post.symbol}><h2>{post.title || post.symbol}</h2><a href={`https://www.reddit.com/comments/${post.symbol}`} target="_blank" rel="noreferrer">View Reddit post</a><p>{post.price === null ? 'No measured price yet' : `${post.price} credits`} · {post.terminal ? 'Removed — terminal price zero' : post.status === 'collecting' ? 'Collecting momentum — check again after five minutes' : post.stale ? 'Stale price — waiting for collection' : `Observed ${new Date(post.observed_at!).toLocaleString()}`}</p>{post.momentum !== null && <p>Score growth: {post.momentum.toFixed(2)} points/minute</p>}<button disabled={post.terminal || post.status !== 'ready'} onClick={() => setSelected({ symbol: post.symbol, action: 'BUY' })}>Buy shares</button> <button disabled={post.terminal || post.status !== 'ready'} onClick={() => setSelected({ symbol: post.symbol, action: 'OPTION' })}>Buy option</button></article>)}
  </>
}
