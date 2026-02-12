import WebApp from '@twa-dev/sdk';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const initData = WebApp.initData || '';

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(initData ? { Authorization: `tma ${initData}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}
