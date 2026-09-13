import { lazy, Suspense } from 'react'
import { useResource, credits } from '../data'
import ReadState from './ReadState'
const HistoryChart = lazy(() => import('./HistoryChart'))
interface Observation { price: number; observed_at: string }
export default function PriceHistory({ symbol }: { symbol: string }) {
  const state = useResource<Observation[]>(`/prices/${symbol}`)
  const rows = [...(state.data || [])].sort((a, b) => Date.parse(a.observed_at) - Date.parse(b.observed_at))
  return <section aria-label={`Price history for ${symbol}`}><h3>Price history</h3>
    <p>Latest 500 price observations.</p>
    <button disabled={state.loading} onClick={state.reload}>Refresh price history</button>
    <ReadState {...state} hasData={state.data !== undefined} />
    {state.data && rows.length < 2 && <p>Insufficient history to show a trend.{rows.length === 1 && ` One observation: ${credits(rows[0].price)}.`}</p>}
    {rows.length > 0 && <><Suspense fallback={<p role="status">Loading price chart…</p>}><HistoryChart label={`Price chart for ${symbol}`} points={rows.map(row => ({ time: Date.parse(row.observed_at), value: row.price }))} /></Suspense>
      <details><summary>View price observations</summary><div className="table-scroll"><table><caption>Observed prices in virtual credits</caption><thead><tr><th>Observed</th><th>Price</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.observed_at}:${index}`}><td>{new Date(row.observed_at).toLocaleString()}</td><td>{credits(row.price)}</td></tr>)}</tbody></table></div></details></>}
  </section>
}
