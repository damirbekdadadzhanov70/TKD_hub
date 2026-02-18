import WebApp from '@twa-dev/sdk';

const REAL_API_URL = import.meta.env.VITE_API_URL;
const BASE_URL = REAL_API_URL || '/api';

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  // In demo mode (no API configured), skip network calls
  if (!REAL_API_URL) return {} as T;

  const initData = WebApp.initData || '';

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(initData ? { Authorization: `tma ${initData}` } : {}),
    ...options.headers,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    signal: options.signal || controller.signal,
  }).finally(() => clearTimeout(timeoutId));

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  if (response.status === 204) return {} as T;

  return response.json();
}
