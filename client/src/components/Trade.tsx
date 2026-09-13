import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { guidance, mutation } from '../api'
import { useAuth } from '../context/auth'
import { useOperations } from '../operations'
import { credits, number, useNow } from '../data'
import { OptionsExplanation, OptionTerms } from './Explanations'
import OperationNotice from './OperationNotice'
export interface Quote { id: string; price: number; cost: number; expires_at: string; strike: number | null; premium: number | null; contract_size: number; quantity: number; option_expiry: string | null; pricing_model?: string }
export default function Trade({ symbol, title, action, shares, onDone }: { symbol: string; title?: string; action: 'BUY' | 'SELL' | 'SELL_REMOVE' | 'OPTION'; shares?: number; onDone: () => void }) {
  const { user } = useAuth()
  const { run, blocked, operation } = useOperations()
  const [quantity, setQuantity] = useState(action === 'SELL_REMOVE' ? shares || 1 : 1), [type, setType] = useState('CALL'), [days, setDays] = useState(1), [step, setStep] = useState(100)
  const [quote, setQuote] = useState<Quote | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const pending = useRef(false), heading = useRef<HTMLHeadingElement>(null)
  const dialog = useRef<HTMLDialogElement>(null), headingId = useId()
  const now = useNow()
  useEffect(() => {
    if (operation?.status === 'success' && 'quoteId' in operation.body && operation.body.quoteId === quote?.id) onDone()
  }, [operation, quote?.id, onDone])
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement
    const element = dialog.current!
    const background = document.getElementById('root')!
    const wasInert = background.inert
    const wasHidden = background.getAttribute('aria-hidden')
    const overflow = document.body.style.overflow
    element.showModal()
    document.body.style.overflow = 'hidden'
    heading.current?.focus()
    background.inert = true
    background.setAttribute('aria-hidden', 'true')
    return () => {
      background.inert = wasInert
      if (wasHidden === null) background.removeAttribute('aria-hidden')
      else background.setAttribute('aria-hidden', wasHidden)
      element.close()
      document.body.style.overflow = overflow
      if (trigger?.isConnected) trigger.focus()
    }
  }, [])
  const selling = action.startsWith('SELL')
  const label = action === 'SELL_REMOVE' ? 'Sell and remove' : action === 'OPTION' ? 'Buy option' : selling ? 'Sell shares' : 'Buy shares'
  const valid = Number.isSafeInteger(quantity) && quantity >= 1 && quantity <= 1000000 && (!selling || shares === undefined || quantity <= shares)
  const affordable = !quote || selling || !!user && quote.cost <= user.credits
  const safe = !quote || Number.isSafeInteger(quote.cost) && quote.cost >= 0
  async function submit(execute: boolean) {
    if (pending.current || blocked || !user || !valid) return
    pending.current = true; setBusy(true); setError('')
    try {
      if (execute && quote) {
        if (!affordable || !safe) return
        const summary = `${label}: ${title || symbol} (${symbol}), ${number(quote.quantity)} ${action === 'OPTION' ? `${type} contracts, strike ${credits(quote.strike!)}` : 'shares'}. ${selling ? 'Proceeds' : 'Cost'}: ${credits(quote.cost)}.`
        await run('/orders', { quoteId: quote.id }, summary)
      } else {
        setQuote(await mutation<Quote>('/quotes', { generation: user.generation, symbol, action, quantity, ...(action === 'OPTION' ? { optionType: type, days, step } : {}) }))
      }
    } catch (e) { setError(guidance(e)) }
    finally { pending.current = false; setBusy(false) }
  }
  return createPortal(<dialog ref={dialog} className="trade trade-modal" aria-labelledby={headingId} aria-modal="true"
    onKeyDown={event => {
      if (event.key !== 'Tab') return
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], summary, [tabindex]:not([tabindex="-1"])')].filter(element => element.tabIndex >= 0 && element.getClientRects().length > 0)
      const first = controls[0], last = controls.at(-1)
      if (!first) { event.preventDefault(); heading.current?.focus() }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === heading.current)) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }}
    onCancel={event => { event.preventDefault(); if (!busy) onDone() }}
    onClick={event => {
      if (event.target !== event.currentTarget || busy) return
      const bounds = event.currentTarget.getBoundingClientRect()
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onDone()
    }}>
    <div className="trade-modal-header"><h2 id={headingId} ref={heading} tabIndex={-1}>{label} · {title || symbol}</h2>
      <button className="modal-close" aria-label="Close trade dialog" disabled={busy} onClick={onDone}>×</button></div>
    {operation && 'quoteId' in operation.body && operation.body.quoteId === quote?.id && <OperationNotice />}
    <p>Post ID: {symbol} · Available balance: {credits(user?.credits || 0)}</p>
    {action === 'SELL_REMOVE' && <p>Sell the entire holding and free its position slot.</p>}
    {action === 'OPTION' && <OptionsExplanation />}
    {!quote && <><label>{action === 'OPTION' ? 'Contracts' : 'Shares'}<input type="number" min="1" max={Math.min(shares ?? 1000000, 1000000)} step="1" value={quantity} disabled={busy || blocked || action === 'SELL_REMOVE'} onChange={e => setQuantity(Number(e.target.value))} /></label>
      {!valid && <p role="alert">Enter a whole quantity from 1 to {number(Math.min(shares ?? 1000000, 1000000))}.</p>}
      {action === 'OPTION' && <><label>Type<select value={type} disabled={busy || blocked} onChange={e => setType(e.target.value)}><option>CALL</option><option>PUT</option></select></label>
        <label>Term<select value={days} disabled={busy || blocked} onChange={e => setDays(Number(e.target.value))}>{[1, 3, 7, 30].map(d => <option key={d} value={d}>{d} days</option>)}</select></label>
        <label>Strike relative to current price<select value={step} disabled={busy || blocked} onChange={e => setStep(Number(e.target.value))}>{[90, 95, 100, 105, 110].map(s => <option key={s} value={s}>{s}%</option>)}</select></label></>}
      <button disabled={busy || blocked || !valid} onClick={() => void submit(false)}>{busy ? 'Getting quote…' : 'Get quote'}</button></>}
    {quote && <><p>Quoted underlying price: {credits(quote.price)} per share.</p>
      {quote.strike !== null && <p>{type} · Strike: {credits(quote.strike)} · Premium: {credits(quote.premium!)} per share · {quote.contract_size} shares per contract.</p>}
      <p>{number(quote.quantity)} × {number(quote.premium ?? quote.price)} × {number(quote.contract_size)} = <strong>{credits(quote.cost)}</strong> {selling ? 'proceeds' : 'total cost'}</p>
      {quote.strike !== null && <OptionTerms type={type} strike={quote.strike} premium={quote.premium!} total={quote.cost} />}
      <p>Quote expires at {new Date(quote.expires_at).toLocaleTimeString()}. {quote.option_expiry && `Option expires ${new Date(quote.option_expiry).toLocaleString()}.`}</p>
      {now >= Date.parse(quote.expires_at) && <p role="status">Quote expired. Request a new quote, unless an order outcome above is still unknown.</p>}
      {!affordable && <p role="alert">Insufficient virtual credits. Request a new quote for a smaller quantity.</p>}
      {!safe && <p role="alert">This total exceeds the supported integer range.</p>}
      <button disabled={busy || blocked || !affordable || !safe || now >= Date.parse(quote.expires_at)} onClick={() => void submit(true)}>{busy ? 'Submitting…' : 'Confirm order'}</button>
      <button disabled={busy || blocked} onClick={() => { setQuote(null); setError('') }}>New quote</button></>}
    <button disabled={busy} onClick={onDone}>Cancel</button>
    {error && <p role="alert">{error}</p>}
  </dialog>, document.body)
}
