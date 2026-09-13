import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, message } from '../api'
import { credits, number, useResource } from '../data'
import ReadState from './ReadState'

interface Observation { price: number; observed_at: string }
interface Holding { symbol: string; title: string; shares: number }
interface Stock extends Holding { observations: Observation[]; error?: string }
async function loadStocks(path: string, init?: RequestInit): Promise<Stock[]> {
  const holdings = await api<Holding[]>(path, init)
  return Promise.all(holdings.filter(holding => holding.shares > 0).map(async holding => {
    try {
      return { ...holding, observations: await api<Observation[]>(`/prices/${encodeURIComponent(holding.symbol)}`, init) }
    } catch (error) {
      return { ...holding, observations: [], error: message(error) }
    }
  }))
}

export default function HoldingsChart() {
  const state = useResource<Stock[]>('/holdings', loadStocks)
  const [mode, setMode] = useState('price')
  const stocks = state.data || []
  const rows = new Map<number, Record<string, number>>()
  stocks.forEach((stock, index) => stock.observations.forEach(observation => {
    const time = Date.parse(observation.observed_at)
    const row = rows.get(time) || { time }
    row[`stock${index}`] = observation.price * (mode === 'value' ? stock.shares : 1)
    rows.set(time, row)
  }))
  const data = [...rows.values()].sort((a, b) => a.time - b.time)
  const color = (index: number) => `hsl(${(index * 137.508 + 215) % 360} 65% 35%)`
  const name = (stock: Stock) => `${stock.title || stock.symbol} (${stock.symbol})`
  return <section aria-label="Held stocks over time"><h2>Held stocks over time</h2>
    <label>Chart values<select value={mode} onChange={event => setMode(event.target.value)}><option value="price">Unit price</option><option value="value">Total value</option></select></label>
    <p>{mode === 'price' ? 'Price per share in virtual credits.' : 'Price multiplied by the shares you currently hold. This compares today’s holdings over time, not your past share counts.'} Latest 500 observations per stock.</p>
    <button disabled={state.loading} onClick={state.reload}>Refresh stock chart</button>
    <ReadState {...state} hasData={state.data !== undefined} />
    {state.data?.length === 0 && <p>No stocks held yet.</p>}
    {stocks.map(stock => stock.error ? <p role="alert" key={stock.symbol}>{name(stock)}: {stock.error} Use Refresh stock chart to retry.</p> : stock.observations.length < 2 && <p key={stock.symbol}>{name(stock)}: {stock.observations.length ? 'Only one price observation; more are needed for a trend.' : 'No price history yet.'}</p>)}
    {data.length > 0 && <div className="history-chart" role="region" aria-label="Held stocks chart">
      <p className="chart-legend">{stocks.map((stock, index) => <span key={stock.symbol} style={{ color: color(index) }}>{name(stock)}</span>)}</p>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 12, right: 16, bottom: 8, left: 0 }} accessibilityLayer>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="time" type="number" domain={data.length === 1 ? [data[0].time - 60000, data[0].time + 60000] : ['dataMin', 'dataMax']} tickFormatter={value => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} minTickGap={40} />
          <YAxis width={64} domain={[0, 'auto']} tickFormatter={value => number(value)} />
          <Tooltip labelFormatter={value => new Date(Number(value)).toLocaleString()} formatter={value => credits(Number(value))} />
          {stocks.map((stock, index) => <Line key={stock.symbol} dataKey={`stock${index}`} name={name(stock)} stroke={color(index)} strokeDasharray={index % 3 === 0 ? undefined : index % 3 === 1 ? '8 3' : '3 3'} strokeWidth={2} type="linear" connectNulls dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />)}
        </LineChart>
      </ResponsiveContainer>
      <p className="chart-caption">Time → · {mode === 'price' ? 'Unit price' : 'Total value'} in virtual credits. Each point is a recorded observation.</p>
      <details><summary>View held stock observations</summary><div className="table-scroll"><table><thead><tr><th>Stock</th><th>Observed</th><th>{mode === 'price' ? 'Unit price' : 'Total value'}</th></tr></thead><tbody>{stocks.flatMap(stock => [...stock.observations].sort((a, b) => Date.parse(a.observed_at) - Date.parse(b.observed_at)).map((observation, index) => <tr key={`${stock.symbol}:${index}`}><td>{name(stock)}</td><td>{new Date(observation.observed_at).toLocaleString()}</td><td>{credits(observation.price * (mode === 'value' ? stock.shares : 1))}</td></tr>))}</tbody></table></div></details>
    </div>}
  </section>
}
