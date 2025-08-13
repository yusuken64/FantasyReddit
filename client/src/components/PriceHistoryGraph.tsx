import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea
} from 'recharts';

interface PricePoint {
  timestamp: string; // ISO string
  price: number;
}

interface PriceHistoryGraphProps {
  userId: number;
  stockSymbol: string;
  start: string;  // ISO date string
  end: string;    // ISO date string
  latestPrice?: PricePoint;
  buyInPrice: number
}

const PriceHistoryGraph: React.FC<PriceHistoryGraphProps> = (
  { userId, stockSymbol, start, end, latestPrice, buyInPrice }) => {
  const [data, setData] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userId == null) {
      setData([]);
      return;
    }
    async function fetchPriceHistory() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          stockSymbol,
          start,
          end,
        });
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/api/price-history?${params.toString()}`,
          { credentials: 'include' }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: PricePoint[] = await res.json();
        const filtered = json.filter(p => p.timestamp && !isNaN(new Date(p.timestamp).getTime()));

        let merged = [...filtered];
        if (latestPrice) {
          const latestTime = new Date(latestPrice.timestamp).getTime();
          const maxFetchedTime = merged.length > 0
            ? Math.max(...merged.map(p => new Date(p.timestamp).getTime()))
            : 0;
          if (latestTime > maxFetchedTime) {
            merged.push(latestPrice);
            merged.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          }
        }
        setData(merged);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }

    fetchPriceHistory();
  }, [userId, stockSymbol, start, end, latestPrice]);


  if (loading) return <div>Loading price history...</div>;
  if (error) return <div>Error loading price history: {error}</div>;
  if (data.length === 0) return <div>No data for this time range.</div>;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart
        data={data}
        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
      >
        <defs>
          <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2e86de" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#2e86de" stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="timestamp"
          tickFormatter={(str) =>
            new Date(str).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
          }
          minTickGap={30}
        />
        <YAxis
          tickFormatter={(value) => `$${value.toFixed(2)}`}
          domain={['auto', 'auto']}
        />
        <Tooltip
          labelFormatter={(label) => {
            const date = new Date(label);
            return isNaN(date.getTime())
              ? 'Invalid date'
              : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
          }}
          formatter={(value) => [`${value}`, 'Price']}
        />
        <Line
          type="monotone"
          dataKey="price"
          stroke="#2e86de"
          strokeWidth={3}
          dot={(props) => {
            if (props.payload.timestamp === latestPrice?.timestamp) {
              return <circle cx={props.cx} cy={props.cy} r={5} fill="red" />;
            }
            // if (props.payload.timestamp === buyInTimestamp) {
            //   return <circle cx={props.cx} cy={props.cy} r={5} fill="green" />;
            // }
            return <circle cx={props.cx} cy={props.cy} r={3} fill="#fff" stroke="#2e86de" />;
          }}
          activeDot={{ r: 6 }}
          fill="url(#colorScore)"
          fillOpacity={1}
        />
        {buyInPrice != null && (
          <>
            <ReferenceLine
              y={buyInPrice}
              stroke="green"
              strokeDasharray="4 4"
              label={{
                value: `Buy-in $${buyInPrice.toFixed(2)}`,
                position: 'right',
                fill: 'green',
                fontSize: 12
              }}
            />
            <ReferenceArea
              y1={buyInPrice - 1}
              y2={buyInPrice + 1}
              fill="green"
              fillOpacity={0.1}
            />
          </>
        )}

        <ReferenceArea
          y1={buyInPrice - 1}
          y2={buyInPrice + 1}
          fill="green"
          fillOpacity={0.1}
        />

      </LineChart>
    </ResponsiveContainer>
  );

};

export default PriceHistoryGraph;
