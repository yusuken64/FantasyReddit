import { useResource, credits } from '../data'
import ReadState from './ReadState'
interface Observation { price: number; observed_at: string; pricing_model: string }
export default function PriceHistory({ symbol }: { symbol: string }) {
  const state = useResource<Observation[]>(`/prices/${symbol}`)
  const rows = [...(state.data || [])].sort((a, b) => Date.parse(a.observed_at) - Date.parse(b.observed_at))
  return <section aria-label={`Price history for ${symbol}`}><h3>Price history</h3>
    <p>Latest 500 persisted observations. Different pricing models are labeled separately and are not a continuous comparable trend.</p>
    <ReadState {...state} hasData={state.data !== undefined} />
    {state.data && rows.length < 2 && <p>Insufficient history to show a trend.{rows.length === 1 && ` One observation: ${credits(rows[0].price)}.`}</p>}
    {rows.length > 0 && <div className="table-scroll"><table><caption>Observed prices in virtual credits</caption><thead><tr><th>Observed</th><th>Price</th><th>Pricing model</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.observed_at}:${index}`}><td>{new Date(row.observed_at).toLocaleString()}</td><td>{credits(row.price)}</td><td>{row.pricing_model}</td></tr>)}</tbody></table></div>}
  </section>
}
