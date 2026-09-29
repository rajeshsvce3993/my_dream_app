import * as SecureStore from 'expo-secure-store';
import { getApiBaseUrl } from './getApiBaseUrl';

type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string } };

let refreshInFlight: Promise<boolean> | null = null;

export async function setTokens(access: string, refresh: string) {
  await SecureStore.setItemAsync('accessToken', access);
  await SecureStore.setItemAsync('refreshToken', refresh);
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync('accessToken');
  await SecureStore.deleteItemAsync('refreshToken');
}

export async function hasSession(): Promise<boolean> {
  try {
    const access = await SecureStore.getItemAsync('accessToken');
    const refresh = await SecureStore.getItemAsync('refreshToken');
    return Boolean(access || refresh);
  } catch {
    return false;
  }
}

async function refreshAccessToken(): Promise<boolean> {
  const storedRefresh = await SecureStore.getItemAsync('refreshToken');
  if (!storedRefresh) return false;
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
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

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body != null) headers.set('Content-Type', 'application/json');
  const token = await SecureStore.getItemAsync('accessToken');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, { ...init, headers });
  } catch {
    throw new Error('No internet connection. We’ll reconnect automatically.');
  }

  if (response.status === 401 && !path.includes('/auth/refresh')) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      await clearTokens();
    } else {
      const next = await SecureStore.getItemAsync('accessToken');
      if (next) headers.set('Authorization', `Bearer ${next}`);
      response = await fetch(`${getApiBaseUrl()}${path}`, { ...init, headers });
    }
  }

  const json = (await response.json()) as ApiResponse<T>;
  if (!json.success) throw new Error(json.error?.message || 'Request failed');
  return json.data;
}
