import HistoryChart from './HistoryChart'
import HoldingsChart from './HoldingsChart'
import { credits, useResource } from '../data'
import ReadState from './ReadState'
interface Portfolio { credits: number; holdings_value: number; portfolio_value: number; stale: boolean; history: { bucket: string; credits: number; holdings_value: number }[] }
export default function Portfolio() {
  const state = useResource<Portfolio>('/portfolio'), data = state.data
  return <><h1>Portfolio</h1><button disabled={state.loading} onClick={state.reload}>Refresh portfolio</button>
    <ReadState {...state} hasData={data !== undefined} />
    {data && <><div className="summary"><article><h2>Cash</h2>{credits(data.credits)}</article><article><h2>Stocks</h2>{credits(data.holdings_value)}</article><article><h2>Cash + stocks</h2>{credits(data.portfolio_value)}</article></div><p>Open options are shown separately on the Options page; these totals exclude their unrealized value.</p>
      {data.stale && <p>Some prices are stale. Values will update after new observations are collected.</p>}<h2>Cash and stock value over time</h2>
      {data.history.length < 2 && <p>Insufficient history to show a trend. Snapshots are collected over time.</p>}
      {data.history.length > 0 && <HistoryChart label="Portfolio value chart" seriesName="Cash + stocks" points={data.history.map(row => ({ time: Date.parse(row.bucket), value: row.credits + row.holdings_value }))} />}
    </>}
    <HoldingsChart />
  </>
}
