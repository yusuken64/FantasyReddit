import { useQuery } from '@tanstack/react-query';

export const useTrends = () =>
  useQuery({
    queryKey: ['trends'],
    queryFn: async () => {
      const res = await fetch('http://localhost:5000/api/trends');
      if (!res.ok) throw new Error('Failed to fetch trends');
      return res.json();
    },
  });
