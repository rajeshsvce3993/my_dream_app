const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1';

const ACCESS_KEY = 'vendorAccessToken';
const REFRESH_KEY = 'vendorRefreshToken';

export type ApiResponse<T> =
  | { success: true; data: T; message?: string | null }
  | { success: false; error: { code?: string; message: string; details?: unknown[] } };

let accessToken: string | null = localStorage.getItem(ACCESS_KEY);
let refreshToken: string | null = localStorage.getItem(REFRESH_KEY);

export function hasSession() {
  return Boolean(accessToken || refreshToken);
}

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshToken) return false;
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return false;
  const json = (await res.json()) as ApiResponse<{ accessToken: string; refreshToken: string }>;
  if (!json.success) return false;
  setTokens(json.data.accessToken, json.data.refreshToken);
  return true;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body != null) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    throw new Error(`Cannot reach the API at ${API_BASE}. Start the backend.`);
  }

  if (response.status === 401 && refreshToken && !path.includes('/auth/refresh')) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers.set('Authorization', `Bearer ${accessToken}`);
      response = await fetch(`${API_BASE}${path}`, { ...init, headers });
    } else {
      clearTokens();
    }
  }

  const json = (await response.json()) as ApiResponse<T>;
  if (!json.success) {
    const error = new Error(json.error.message || 'Request failed') as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return json.data;
}

export async function apiRequestWithToken<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body != null) headers.set('Content-Type', 'application/json');
  headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const json = (await response.json()) as ApiResponse<T>;
  if (!json.success) {
    const error = new Error(json.error.message || 'Request failed') as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return json.data;
}
