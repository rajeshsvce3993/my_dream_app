import type { QueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';

export const AUTH_TOKEN_QUERY_KEY = ['auth-has-token'] as const;
export const AUTH_ME_QUERY_KEY = ['auth-me'] as const;

export async function readHasAccessToken(): Promise<boolean> {
  const access = await SecureStore.getItemAsync('accessToken');
  const refresh = await SecureStore.getItemAsync('refreshToken');
  return Boolean(access || refresh);
}

/** Call after login, logout, or token changes so headers/profile refresh. */
export async function invalidateAuthSession(qc: QueryClient): Promise<void> {
  await qc.invalidateQueries({ queryKey: AUTH_TOKEN_QUERY_KEY });
  await qc.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY });
}
