import { useState, useEffect } from 'react';

// Simple in-memory cache
const cache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes

export function useSupabaseQuery<T>(
  key: string,
  queryFn: () => Promise<T>,
  options = { cacheTime: CACHE_EXPIRATION_MS }
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = async (ignoreCache = false) => {
    try {
      setLoading(true);
      setError(null);

      if (!ignoreCache && cache[key]) {
        const isExpired = Date.now() - cache[key].timestamp > options.cacheTime;
        if (!isExpired) {
          setData(cache[key].data);
          setLoading(false);
          // Optional: stale-while-revalidate could go here
          return;
        }
      }

      const result = await queryFn();
      cache[key] = { data: result, timestamp: Date.now() };
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
  }, [key]);

  return { data, loading, error, refetch: () => fetch(true) };
}
