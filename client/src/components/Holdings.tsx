import { useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { guidance, mutation } from '../api'
import { useAuth } from '../context/auth'
import { useOperations } from '../operations'
import { credits, fresh, invalidateData, number, useNow, useResource } from '../data'
import Trade from './Trade'
import ReadState from './ReadState'
import PriceHistory from './PriceHistory'
interface Holding { symbol: string; title: string; shares: number; total_spent: number; price: number | null; observed_at: string | null; terminal: boolean; stale: boolean }
export default function Holdings() {
  const { user, refresh } = useAuth(), { blocked } = useOperations()
  const state = useResource<Holding[]>('/holdings')
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<{ symbol: string; title: string; action: 'SELL' | 'SELL_REMOVE'; shares: number } | null>(null)
  const pending = useRef(false), keys = useRef(new Map<string, string>()), now = useNow()
  async function remove(symbol: string) {
    if (pending.current || !user || blocked) return
    pending.current = true; setBusy(true); setError('')
    const key = keys.current.get(symbol) || crypto.randomUUID(); keys.current.set(symbol, key)
    try { await mutation(`/holdings/${symbol}`, { generation: user.generation }, key, 'DELETE'); invalidateData(); await refresh() } catch (e) { setError(guidance(e)) }
    finally { pending.current = false; setBusy(false) }
  }
  return <><h1>Holdings</h1><button disabled={state.loading} onClick={state.reload}>Refresh holdings</button>
    <ReadState {...state} hasData={state.data !== undefined} />{error && <p role="alert">{error}</p>}
    {selected && <Trade key={`${selected.symbol}:${selected.action}`} {...selected} onDone={() => setSelected(null)} />}
    {state.data?.length === 0 && <p>No holdings yet. <NavLink to="/redditStocks">Browse stocks</NavLink></p>}
    {state.data?.map(h => <article key={h.symbol}><h2>{h.title || h.symbol}</h2>
      <p>{number(h.shares)} shares · {h.price === null ? 'Price unavailable' : `${credits(h.price)} per share · Value: ${credits(h.shares * h.price)}`}. Cost basis: {credits(h.total_spent)}.</p>
      {!fresh(h, now) && <p>Price unavailable or stale — refresh to check for a new price.</p>}
      {h.observed_at && <p>Observed {new Date(h.observed_at).toLocaleString()}</p>}
      <PriceHistory symbol={h.symbol} />
      {h.terminal || h.shares === 0 ? <button disabled={busy || blocked} onClick={() => void remove(h.symbol)}>Remove zero-value holding</button> : <div className="actions"><button className="sell" disabled={blocked || !!state.error} onClick={() => setSelected({ symbol: h.symbol, title: h.title, shares: h.shares, action: 'SELL' })}>Sell shares</button><button className="sell" disabled={blocked || !!state.error} onClick={() => setSelected({ symbol: h.symbol, title: h.title, shares: h.shares, action: 'SELL_REMOVE' })}>Sell and remove</button></div>}
    </article>)}
  </>
}
