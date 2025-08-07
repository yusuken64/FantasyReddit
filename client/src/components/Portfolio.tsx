import { useContext, useEffect, useState } from 'react';
import Debug from './Debug';
import { AuthContext } from '../context/AuthContext';
import { PortfolioCharts } from './PortfolioCharts';

type PortfolioStats = {
    username: string;
    credits: number;
    totalScore: number;
    stocksOwned: number;
    totalShares: number;
    totalSpent: number;
    totalValue: number;
};

export default function Portfolio() {
    const { username } = useContext(AuthContext);
    const [stats, setStats] = useState<PortfolioStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {

        async function fetchStats() {
            if (!username) return;

            setLoading(true);
            setError(null);
            try {
                const res = await fetch(
                    `${import.meta.env.VITE_API_URL}/portfolio`,
                    {
                        credentials: 'include',
                    }
                );
                if (!res.ok) throw new Error('Failed to fetch portfolio stats');
                const data = await res.json();
                console.log(data);
                setStats(data);
            } catch (e: any) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        }

        fetchStats();
    }, [username]);

    if (loading) return <div>Loading your portfolio...</div>;
    if (error) return <div>Error: {error}</div>;
    if (!stats) return <div>No portfolio data available.</div>;

    return (
        <div style={{ maxWidth: 800, margin: 'auto', padding: 20 }}>
            <div
                style={{
                    fontSize: '2rem',
                    fontWeight: 'bold',
                    // marginBottom: '1.5rem',
                    // padding: '1rem',
                    background: '#f5f5f5',
                    borderRadius: '8px',
                    textAlign: 'center',
                }}
            >
                Total Portfolio Value: ${(stats.credits + stats.totalValue).toLocaleString()}
            </div>

            <PortfolioCharts
                credits={stats.credits}
                totalValue={stats.totalValue + stats.credits}
                totalSpent={stats.totalSpent}
            />
            <section>
                <h2>User Summary</h2>
                <p><strong>Username:</strong> {stats.username}</p>
                <p><strong>Credits:</strong> {stats.credits.toLocaleString()}</p>
                <p><strong>Total Portfolio Value:</strong> {(stats.credits + stats.totalValue).toLocaleString()}</p>
                <p><strong>Stocks Owned:</strong> {stats.stocksOwned}</p>
                <p><strong>Total Shares:</strong> {stats.totalShares}</p>
                <p><strong>Total Spent:</strong> {stats.totalSpent}</p>
            </section>

            {/* <section style={{ marginBottom: 40 }}>
                <Leaderboard />
            </section> */}

            <section>
                <Debug />
            </section>
        </div>
    );
}
