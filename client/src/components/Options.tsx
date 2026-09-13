import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/auth'
import { useOperations } from '../operations'
import { credits, fresh, number, useNow, useResource } from '../data'
import { message } from '../api'
import ReadState from './ReadState'
import { OptionsExplanation, OptionTerms } from './Explanations'
interface Option { id: string; symbol: string; option_type: string; strike: number; premium: number; total_premium: number; quantity: number; expires_at: string; settlement_status: string }
interface Observation { price: number | null; observed_at: string | null; stale: boolean; terminal: boolean; status: string }
function Exercise({ option, close }: { option: Option; close: () => void }) {
  const { user } = useAuth(), { blocked, run, operation } = useOperations()
  const state = useResource<Observation>(`/market/${option.symbol}`)
  const now = useNow(), heading = useRef<HTMLHeadingElement>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (operation?.status === 'success' && operation.path === `/options/${option.id}/exercise`) close()
  }, [operation, option.id, close])
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement
    heading.current?.focus()
    return () => { if (trigger?.isConnected) trigger.focus() }
  }, [])
  const observation = state.data
  const estimated = observation?.price !== null && observation?.price !== undefined && observation.status === 'ready' && fresh(observation, now) && !state.error
    ? Math.max(option.option_type === 'CALL' ? observation.price - option.strike : option.strike - observation.price, 0) * 100 * option.quantity : null
  return <section className="trade" aria-label="Exercise confirmation"><h2 ref={heading} tabIndex={-1}>Confirm exercise</h2>
    <p>{option.symbol} · {option.option_type} · {number(option.quantity)} contracts · Strike {credits(option.strike)}.</p>
    <p>Exercise ends this contract. It can pay zero, losing the entire {credits(option.total_premium)} premium.</p>
    <ReadState {...state} hasData={state.data !== undefined} />
    {estimated !== null && Number.isSafeInteger(estimated) ? <p>Estimated payout: {credits(estimated)}. Estimated profit after premium: {credits(estimated - option.total_premium)}. This estimate is not locked; the server determines the final payout.</p> : <p>A fresh payout estimate is unavailable. You can refresh the observation or cancel.</p>}
    <button disabled={blocked || now >= Date.parse(option.expires_at)} onClick={() => {
      if (user) void run(`/options/${option.id}/exercise`, { generation: user.generation }, `Exercise ${option.symbol} ${option.option_type}, ${number(option.quantity)} contracts; premium paid: ${credits(option.total_premium)}.`).catch(e => setError(message(e)))
    }}>Confirm exercise</button><button disabled={blocked} onClick={close}>Cancel exercise</button>
    {now >= Date.parse(option.expires_at) && <p>Expired options settle automatically. Refresh options to check settlement.</p>}
    {error && <p role="alert">{error}</p>}
  </section>
}
export default function Options() {
  const [offset, setOffset] = useState(0), [selected, setSelected] = useState<Option | null>(null)
  const { blocked } = useOperations(), now = useNow()
  const state = useResource<Option[]>(`/options?offset=${offset}&limit=25&dir=ASC`)
  return <><h1>Options</h1><OptionsExplanation /><button disabled={state.loading} onClick={state.reload}>Refresh options</button>
    <ReadState {...state} hasData={state.data !== undefined} />
    {selected && <Exercise key={selected.id} option={selected} close={() => setSelected(null)} />}
    {state.data?.length === 0 && <p>No options on this page.</p>}
    {state.data?.map(o => <article key={o.id}><h2>{o.symbol} {o.option_type} · Strike {credits(o.strike)}</h2>
      <p>{number(o.quantity)} contracts × 100 shares · {credits(o.premium)} premium per share · {credits(o.total_premium)} total premium</p>
      <OptionTerms type={o.option_type} strike={o.strike} premium={o.premium} total={o.total_premium} />
      <p>Expires {new Date(o.expires_at).toLocaleString()} · {o.settlement_status}</p>
      {o.settlement_status === 'PENDING' && <p>Waiting for a valid settlement observation. Refresh to check again.</p>}
      <button disabled={blocked || o.settlement_status !== 'OPEN' || Date.parse(o.expires_at) <= now || !!state.error} onClick={() => setSelected(o)}>Exercise</button>
    </article>)}
    <div className="actions"><button disabled={offset === 0} onClick={() => { setOffset(offset - 25); setSelected(null) }}>Previous</button><span>Page {offset / 25 + 1}</span><button disabled={state.loading || !state.data || state.data.length < 25 || !!state.error || offset >= 1000000} onClick={() => { setOffset(offset + 25); setSelected(null) }}>Next</button></div>
  </>
}
