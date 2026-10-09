import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { apiRequest } from './api';
import {
  AUTH_ME_QUERY_KEY,
  AUTH_TOKEN_QUERY_KEY,
  readHasAccessToken,
} from './authSession';

type Me = {
  firstName: string;
  lastName?: string;
  displayName?: string;
  phone?: string;
  phoneVerified?: boolean;
  hasSavedAddress?: boolean;
};

export function useAuthSession() {
  const tokenQuery = useQuery({
    queryKey: AUTH_TOKEN_QUERY_KEY,
    queryFn: readHasAccessToken,
    staleTime: 5 * 60_000,
  });

  const hasToken = tokenQuery.data ?? null;

  const me = useQuery({
    queryKey: AUTH_ME_QUERY_KEY,
    queryFn: () => apiRequest<Me>('/auth/me'),
    enabled: hasToken === true,
    retry: false,
    staleTime: 60_000,
  });

  const signedIn = hasToken === true && Boolean(me.data);
  const greetingName = useMemo(() => {
    if (!signedIn || !me.data) return 'Guest';
    const name = me.data.displayName?.trim();
    if (name && name.toLowerCase() !== 'customer') return name;
    if (me.data.firstName && me.data.firstName.toLowerCase() !== 'customer') {
      return me.data.lastName ? `${me.data.firstName} ${me.data.lastName}`.trim() : me.data.firstName;
    }
    return 'there';
  }, [signedIn, me.data]);

  return { hasToken, signedIn, greetingName, me };
}
