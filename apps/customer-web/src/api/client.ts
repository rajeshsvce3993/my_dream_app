const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1';

export type ApiResponse<T> =
  | { success: true; data: T; message?: string | null; meta?: Record<string, unknown> }
  | { success: false; error: { code: string; message: string; details?: unknown[] } };

let accessToken: string | null = localStorage.getItem('accessToken');
let refreshToken: string | null = localStorage.getItem('refreshToken');

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem('accessToken', access);
  localStorage.setItem('refreshToken', refresh);
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
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
  headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  let response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (response.status === 401 && refreshToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers.set('Authorization', `Bearer ${accessToken}`);
      response = await fetch(`${API_BASE}${path}`, { ...init, headers });
    }
  }

  const json = (await response.json()) as ApiResponse<T>;
  if (!json.success) throw new Error(json.error.message);
  return json.data;
}

export async function apiRequestWithMeta<T>(
  path: string,
  init: RequestInit = {},
): Promise<{ data: T; meta?: Record<string, unknown> }> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  let response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (response.status === 401 && refreshToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers.set('Authorization', `Bearer ${accessToken}`);
      response = await fetch(`${API_BASE}${path}`, { ...init, headers });
    }
  }

  const json = (await response.json()) as ApiResponse<T>;
  if (!json.success) throw new Error(json.error.message);
  return { data: json.data, meta: json.meta };
}
