import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { clearTokens, hasSession } from './api';

export const SESSION_QUERY_KEY = ['vendor-has-session'] as const;

export function useVendorSession() {
  const qc = useQueryClient();
  const session = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: hasSession,
    staleTime: 0,
  });

  const refresh = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
  }, [qc]);

  const signOut = useCallback(async () => {
    await clearTokens();
    qc.removeQueries({ queryKey: ['vendor-me'] });
    qc.removeQueries({ queryKey: ['vendor-orders'] });
    qc.removeQueries({ queryKey: ['vendor-products'] });
    qc.removeQueries({ queryKey: ['vendor-earnings'] });
    qc.removeQueries({ queryKey: ['vendor-order'] });
    await qc.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
  }, [qc]);

  return {
    ready: session.isFetched,
    signedIn: session.data === true,
    refresh,
    signOut,
  };
}
