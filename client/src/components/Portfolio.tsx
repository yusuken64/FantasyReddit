import { useEffect, useState } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, message } from '../api'
interface Portfolio { credits: number; holdings_value: number; portfolio_value: number; stale: boolean; history: { bucket: string; credits: number; holdings_value: number }[] }
export default function Portfolio() {
  const [data, setData] = useState<Portfolio | null>(null), [error, setError] = useState('')
  useEffect(() => { let active = true; api<Portfolio>('/portfolio').then(value => { if (active) setData(value) }).catch(e => { if (active) setError(message(e)) }); return () => { active = false } }, [])
  return <><h1>Portfolio</h1>{error && <p role="alert">{error}</p>}{data && <><div className="summary"><article><h2>Cash</h2>{data.credits} credits</article><article><h2>Stocks</h2>{data.holdings_value} credits</article><article><h2>Cash + stocks</h2>{data.portfolio_value} credits</article></div><p>Open options are shown separately on the Options page; these totals exclude their unrealized value.</p>{data.stale && <p>Some prices are stale. Values will update after Reddit recovers.</p>}<h2>Cash and stock value over time</h2>
    <ResponsiveContainer width="100%" height={300}><LineChart data={[...data.history].reverse().map(row => ({ time: new Date(row.bucket).toLocaleString(), value: row.credits + row.holdings_value }))}><XAxis dataKey="time" hide /><YAxis /><Tooltip /><Line dataKey="value" stroke="#2457a7" dot={false} /></LineChart></ResponsiveContainer></>}</>
}
