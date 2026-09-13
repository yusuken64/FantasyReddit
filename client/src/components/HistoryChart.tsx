import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { number } from '../data'

interface Point { time: number; value: number }
const color = '#2457a7'
export default function HistoryChart({ points, label, seriesName = 'Price' }: { points: Point[]; label: string; seriesName?: string }) {
  const sorted = [...points].sort((a, b) => a.time - b.time)
  const single = sorted.length === 1
  return <div className="history-chart" role="region" aria-label={label}>
    <p className="chart-legend"><span style={{ color }}>● {seriesName}</span></p>
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={sorted} margin={{ top: 12, right: 16, bottom: 8, left: 0 }} accessibilityLayer>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="time" type="number" domain={single ? [sorted[0].time - 60000, sorted[0].time + 60000] : ['dataMin', 'dataMax']} tickFormatter={value => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} minTickGap={40} />
        <YAxis width={64} domain={[0, 'auto']} tickFormatter={value => number(value)} />
        <Tooltip labelFormatter={value => new Date(Number(value)).toLocaleString()} formatter={value => [`${number(Number(value))} virtual credits`]} />
        <Line dataKey="value" name={seriesName} type="linear" stroke={color} strokeWidth={2} connectNulls={false} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
    <p className="chart-caption">Time → · Value in virtual credits. Hover or focus the chart to inspect observations.</p>
  </div>
}
