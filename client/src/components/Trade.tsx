import { useRef, useState } from 'react'
import { message, mutation } from '../api'
import { useAuth } from '../context/auth'
export interface Quote { id: string; price: number; cost: number; expires_at: string; strike: number | null; premium: number | null; contract_size: number; quantity: number; option_expiry: string | null }
export default function Trade({ symbol, action, shares, onDone }: { symbol: string; action: 'BUY' | 'SELL' | 'SELL_REMOVE' | 'OPTION'; shares?: number; onDone: () => void }) {
  const { user, refresh } = useAuth()
  const [quantity, setQuantity] = useState(action === 'SELL_REMOVE' ? shares || 1 : 1), [type, setType] = useState('CALL'), [days, setDays] = useState(1), [step, setStep] = useState(100)
  const [quote, setQuote] = useState<Quote | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const pending = useRef(false), requestKey = useRef(crypto.randomUUID())
  async function submit(execute: boolean) {
    if (pending.current || !user) return
    pending.current = true; setBusy(true); setError('')
    try {
      if (execute && quote) {
        await mutation('/orders', { quoteId: quote.id }, requestKey.current)
        setQuote(null); await refresh(); onDone()
      } else {
        const next = await mutation<Quote>('/quotes', { generation: user.generation, symbol, action, quantity, ...(action === 'OPTION' ? { optionType: type, days, step } : {}) })
        setQuote(next); requestKey.current = crypto.randomUUID()
      }
    } catch (e) { setError(message(e)) }
    finally { pending.current = false; setBusy(false) }
  }
  return <section className="trade" aria-label={`${action} ${symbol}`}><h3>{action.replace('_', ' ')} · {symbol}</h3>
    {!quote && <><label>{action === 'OPTION' ? 'Contracts' : 'Shares'}<input type="number" min="1" max={shares || 1000000} step="1" value={quantity} disabled={busy || action === 'SELL_REMOVE'} onChange={e => setQuantity(Number(e.target.value))} /></label>
      {action === 'OPTION' && <><label>Type<select value={type} onChange={e => setType(e.target.value)}><option>CALL</option><option>PUT</option></select></label>
        <label>Term<select value={days} onChange={e => setDays(Number(e.target.value))}>{[1, 3, 7, 30].map(d => <option key={d} value={d}>{d} days</option>)}</select></label>
        <label>Strike relative to current price<select value={step} onChange={e => setStep(Number(e.target.value))}>{[90, 95, 100, 105, 110].map(s => <option key={s} value={s}>{s}%</option>)}</select></label><p>Each contract represents 100 shares.</p></>}
      <button disabled={busy || !Number.isSafeInteger(quantity) || quantity < 1} onClick={() => void submit(false)}>Get quote</button></>}
    {quote && <><p>Underlying: {quote.price} credits{quote.strike !== null && ` · Strike: ${quote.strike}`}</p>
      <p>{quote.quantity} × {quote.premium ?? quote.price} × {quote.contract_size} = <strong>{quote.cost} credits</strong> {action.startsWith('SELL') ? 'proceeds' : 'total cost'}</p>
      <p>Quote expires at {new Date(quote.expires_at).toLocaleTimeString()}. {quote.option_expiry && `Option expires ${new Date(quote.option_expiry).toLocaleString()}.`}</p>
      <button disabled={busy} onClick={() => void submit(true)}>{busy ? 'Submitting…' : 'Confirm order'}</button> <button disabled={busy} onClick={() => { setQuote(null); setError('') }}>New quote</button></>}
    {error && <p role="alert">{error}</p>}
  </section>
}
