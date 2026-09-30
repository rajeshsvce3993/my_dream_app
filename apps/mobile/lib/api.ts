import * as SecureStore from 'expo-secure-store';
import { getApiBaseUrl } from './getApiBaseUrl';

type ApiResponse<T> =
  | { success: true; data: T; meta?: Record<string, unknown> }
  | { success: false; error: { message: string; code?: string; details?: unknown[] } };

let refreshInFlight: Promise<boolean> | null = null;

export async function setTokens(access: string, refresh: string) {
  await SecureStore.setItemAsync('accessToken', access);
  await SecureStore.setItemAsync('refreshToken', refresh);
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync('accessToken');
  await SecureStore.deleteItemAsync('refreshToken');
}

async function refreshAccessToken(): Promise<boolean> {
  const storedRefresh = await SecureStore.getItemAsync('refreshToken');
  if (!storedRefresh) return false;

  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: storedRefresh }),
      });
      if (!res.ok) return false;
      const json = (await res.json()) as ApiResponse<{ accessToken: string; refreshToken: string }>;
      if (!json.success) return false;
      await setTokens(json.data.accessToken, json.data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

async function authorizedFetch(path: string, init: RequestInit): Promise<Response> {
  const apiBase = getApiBaseUrl();
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body != null) {
    headers.set('Content-Type', 'application/json');
  }

  const token = await SecureStore.getItemAsync('accessToken');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response = await fetch(`${apiBase}${path}`, { ...init, headers });

  const isRefreshCall = path.includes('/auth/refresh');
  if (response.status === 401 && !isRefreshCall) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const newToken = await SecureStore.getItemAsync('accessToken');
      if (newToken) headers.set('Authorization', `Bearer ${newToken}`);
      else headers.delete('Authorization');
      response = await fetch(`${apiBase}${path}`, { ...init, headers });
    } else {
      await clearTokens();
    }
  }

  return response;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const apiBase = getApiBaseUrl();
  if (__DEV__) {
    console.log('[Dream Mobile] API', `${apiBase}${path}`);
  }

  let response: Response;
  try {
    response = await authorizedFetch(path, init);
  } catch {
    throw new Error(
      `Cannot reach the API at ${apiBase}. Start the backend and set EXPO_PUBLIC_API_HOST / EXPO_PUBLIC_API_URL in apps/mobile/.env`,
    );
  }

  let json: ApiResponse<T>;
  try {
    json = (await response.json()) as ApiResponse<T>;
  } catch {
    if (response.status === 429) {
      throw new Error('Too many requests. Please wait a moment and try again.');
    }
    throw new Error(`API returned invalid JSON (${response.status}). Is the backend running?`);
  }
  if (!json.success) throw new Error(json.error.message);
  return json.data;
}

export async function apiRequestWithMeta<T>(
  path: string,
  init: RequestInit = {},
): Promise<{ data: T; meta?: Record<string, unknown> }> {
  const response = await authorizedFetch(path, init);
  const json = (await response.json()) as ApiResponse<T>;
  if (!json.success) throw new Error(json.error.message);
  return { data: json.data, meta: json.meta };
}
