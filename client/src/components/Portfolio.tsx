import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { credits, useResource } from '../data'
import ReadState from './ReadState'
interface Portfolio { credits: number; holdings_value: number; portfolio_value: number; stale: boolean; history: { bucket: string; credits: number; holdings_value: number }[] }
export default function Portfolio() {
  const state = useResource<Portfolio>('/portfolio'), data = state.data
  return <><h1>Portfolio</h1><button disabled={state.loading} onClick={state.reload}>Refresh portfolio</button>
    <ReadState {...state} hasData={data !== undefined} />
    {data && <><div className="summary"><article><h2>Cash</h2>{credits(data.credits)}</article><article><h2>Stocks</h2>{credits(data.holdings_value)}</article><article><h2>Cash + stocks</h2>{credits(data.portfolio_value)}</article></div><p>Open options are shown separately on the Options page; these totals exclude their unrealized value.</p>
      {data.stale && <p>Some prices are stale. Values will update after new observations are collected.</p>}<h2>Cash and stock value over time</h2>
      {data.history.length < 2 ? <p>Insufficient history to show a trend. Snapshots are collected over time.</p> : <ResponsiveContainer width="100%" height={300}><LineChart data={[...data.history].sort((a, b) => Date.parse(a.bucket) - Date.parse(b.bucket)).map(row => ({ time: new Date(row.bucket).toLocaleString(), value: row.credits + row.holdings_value }))}><XAxis dataKey="time" hide /><YAxis /><Tooltip /><Line dataKey="value" name="Virtual credits" stroke="#2457a7" dot={false} /></LineChart></ResponsiveContainer>}
    </>}
  </>
}
