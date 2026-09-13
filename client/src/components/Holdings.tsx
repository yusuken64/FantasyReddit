import { useCallback, useEffect, useRef, useState } from 'react'
import { api, message, mutation } from '../api'
import { useAuth } from '../context/auth'
import Trade from './Trade'
interface Holding { symbol: string; title: string; shares: number; total_spent: number; price: number; terminal: boolean; stale: boolean }
export default function Holdings() {
  const { user, refresh } = useAuth(), [rows, setRows] = useState<Holding[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<{ symbol: string; action: 'SELL' | 'SELL_REMOVE'; shares: number } | null>(null), pending = useRef(false)
  const load = useCallback(async () => { try { setRows(await api<Holding[]>('/holdings')); setError('') } catch (e) { setError(message(e)) } }, [])
  useEffect(() => { void load() }, [load])
  async function remove(symbol: string) {
    if (pending.current || !user) return
    pending.current = true; setBusy(true)
    try { await mutation(`/holdings/${symbol}`, { generation: user.generation }, crypto.randomUUID(), 'DELETE'); await refresh(); await load() } catch (e) { setError(message(e)) }
    finally { pending.current = false; setBusy(false) }
  }
  return <><h1>Holdings</h1>{error && <p role="alert">{error}</p>}{selected && <Trade key={`${selected.symbol}:${selected.action}`} {...selected} onDone={() => { setSelected(null); void load() }} />}
    {!rows.length && <p>No holdings yet.</p>}{rows.map(h => <article key={h.symbol}><h2>{h.title}</h2><p>{h.shares} shares × {h.price} = {h.shares * h.price} credits. Cost basis: {h.total_spent} credits.</p>{!!h.stale && <p>Stale price — awaiting Reddit recovery.</p>}
      {h.terminal || h.shares === 0 ? <button disabled={busy} onClick={() => void remove(h.symbol)}>Remove zero-value holding</button> : <><button onClick={() => setSelected({ symbol: h.symbol, shares: h.shares, action: 'SELL' })}>Sell shares</button> <button onClick={() => setSelected({ symbol: h.symbol, shares: h.shares, action: 'SELL_REMOVE' })}>Sell and remove</button></>}</article>)}
  </>
}
