import { useQuery } from '@tanstack/react-query';

export const useTrends = () =>
  useQuery({
    queryKey: ['trends'],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/trends`);
      if (!res.ok) throw new Error('Failed to fetch trends');
      return res.json();
    },
  });
