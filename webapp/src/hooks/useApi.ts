import { useCallback, useEffect, useState } from 'react';
import WebApp from '@twa-dev/sdk';

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useApi<T>(
  fetcher: () => Promise<T>,
  mockData: T,
  deps: unknown[] = [],
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isTelegram = !!WebApp.initData;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (!isTelegram) {
      // Use mock data when not in Telegram
      await new Promise((r) => setTimeout(r, 300));
      setData(mockData);
      setLoading(false);
      return;
    }

    try {
      const result = await fetcher();
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      // Fall back to mock data on error
      setData(mockData);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
