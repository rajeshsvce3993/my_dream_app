import type { QueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';

export const AUTH_TOKEN_QUERY_KEY = ['auth-has-token'] as const;
export const AUTH_ME_QUERY_KEY = ['auth-me'] as const;

let tokenPresence: boolean | undefined;

export async function readHasAccessToken(): Promise<boolean> {
  if (tokenPresence !== undefined) return tokenPresence;
  const access = await SecureStore.getItemAsync('accessToken');
  const refresh = await SecureStore.getItemAsync('refreshToken');
  tokenPresence = Boolean(access || refresh);
  return tokenPresence;
}

/** Call after login, logout, or token changes so headers/profile refresh. */
export async function invalidateAuthSession(qc: QueryClient): Promise<void> {
  tokenPresence = undefined;
  await qc.invalidateQueries({ queryKey: AUTH_TOKEN_QUERY_KEY });
  await qc.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY });
}
