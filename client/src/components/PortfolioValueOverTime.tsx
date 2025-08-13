// components/PortfolioValueOverTime.tsx
import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface PortfolioPoint {
  timestamp: string; // ISO date string
  credits: number;
  portfolio_value: number;
}

const quickRanges = {
  day: 1,
  week: 7,
  month: 30,
  year: 365,
  max: 10000, // arbitrarily large to cover all data
};

export function PortfolioValueOverTime() {
  const [data, setData] = useState<PortfolioPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'day' | 'week' | 'month' | 'year' | 'max'>('month');

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      try {
        const end = new Date();
        let start: Date;
        if (range === 'max') {
          // Arbitrary very old date for max range
          start = new Date('2000-01-01');
        } else {
          start = new Date();
          start.setDate(end.getDate() - quickRanges[range]);
        }

        const startStr = start.toISOString();
        const endStr = end.toISOString();

        const url = new URL(`${import.meta.env.VITE_API_URL}/portfolio/history`);
        url.searchParams.append('start', startStr);
        url.searchParams.append('end', endStr);

        const res = await fetch(url.toString(), {
          credentials: 'include',
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        const transformed = json.map((point: PortfolioPoint) => ({
          ...point,
          unrealized: point.portfolio_value,
        }));

        setData(transformed);
      } catch (err) {
        console.error('Error fetching portfolio history:', err);
        setData([]);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [range]);

  if (loading) return <p>Loading portfolio history...</p>;

  return (
    <>
      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="range-select">Select Range: </label>
        <select
          id="range-select"
          value={range}
          onChange={(e) => setRange(e.target.value as typeof range)}
        >
          <option value="day">Last Day</option>
          <option value="week">Last Week</option>
          <option value="month">Last Month</option>
          <option value="year">Last Year</option>
          <option value="max">Max</option>
        </select>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(dateStr) => new Date(dateStr).toLocaleDateString()}
          />
          <YAxis />
          <Tooltip
            formatter={(value: number) => `$${value.toLocaleString()}`}
            labelFormatter={(dateStr) =>
              new Date(dateStr).toLocaleString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })
            }
          />
          <Legend />
          <Bar dataKey="credits" stackId="a" fill="#00C49F" name="Cash" />
          <Bar dataKey="unrealized" stackId="a" fill="#FFBB28" name="Stocks" />
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}
