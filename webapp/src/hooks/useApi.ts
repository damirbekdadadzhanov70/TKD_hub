import { useCallback, useEffect, useRef, useState } from 'react';
import WebApp from '@twa-dev/sdk';

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  isDemo: boolean;
  refetch: (silent?: boolean) => Promise<void>;
  mutate: (data: T) => void;
}

const API_URL = import.meta.env.VITE_API_URL;
const hasApi = !!API_URL;

export function useApi<T>(
  fetcher: () => Promise<T>,
  mockData: T | null,
  deps: unknown[] = [],
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  const isTelegram = !!WebApp.initData;

  // Use refs to avoid stale closures for values not in deps
  const mockDataRef = useRef(mockData);
  mockDataRef.current = mockData;
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    if (!silent) setIsDemo(false);

    // Use mock data when: not in Telegram, or no API URL configured
    if (!isTelegram || !hasApi) {
      await new Promise((r) => setTimeout(r, 300));
      setData(mockDataRef.current);
      setIsDemo(isTelegram && !hasApi);
      setLoading(false);
      return;
    }

    try {
      const result = await fetcherRef.current();
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('API error:', message);
      setError(message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, isDemo, refetch: fetchData, mutate: setData };
}
