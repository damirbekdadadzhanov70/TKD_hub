import { useCallback, useEffect, useState } from 'react';
import WebApp from '@twa-dev/sdk';

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  isDemo: boolean;
  refetch: () => void;
}

const API_URL = import.meta.env.VITE_API_URL;
const hasApi = !!API_URL;

export function useApi<T>(
  fetcher: () => Promise<T>,
  mockData: T,
  deps: unknown[] = [],
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  const isTelegram = !!WebApp.initData;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsDemo(false);

    // Use mock data when: not in Telegram, or no API URL configured
    if (!isTelegram || !hasApi) {
      await new Promise((r) => setTimeout(r, 300));
      setData(mockData);
      setIsDemo(isTelegram && !hasApi);
      setLoading(false);
      return;
    }

    try {
      const result = await fetcher();
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('API error:', message);
      // Fall back to mock data instead of showing error
      setData(mockData);
      setIsDemo(true);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, isDemo, refetch: fetchData };
}
