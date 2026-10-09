import { useQuery } from '@tanstack/react-query';
import { apiRequest } from './api';
import { DEFAULT_LOCATION, type AppLocation } from './location';
import { loadDeliveryLocation } from './deliveryLocation';

export function usePublicConfig() {
  return useQuery({
    queryKey: ['mobile-config'],
    queryFn: () => apiRequest<Record<string, unknown>>('/configuration/public'),
    staleTime: 60_000,
    retry: 2,
  });
}

export function useAppLocation(): AppLocation {
  return useResolvedAppLocation().location;
}

/** Saved delivery pin when the customer has one. `ready` is false until that lookup finishes. */
export function useResolvedAppLocation(): { location: AppLocation; ready: boolean } {
  const { data: config } = usePublicConfig();
  const saved = useQuery({
    queryKey: ['delivery-location'],
    queryFn: loadDeliveryLocation,
    staleTime: 30_000,
  });
  const fromDb = config?.['mobile.location.default'] as AppLocation | undefined;
  return {
    location: saved.data ?? fromDb ?? DEFAULT_LOCATION,
    ready: saved.isFetched,
  };
}
