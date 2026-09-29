import { useQuery } from '@tanstack/react-query';
import { apiRequestWithMeta } from './api';
import type { LocationAvailabilityMeta } from './locationMessages';
import { useAppLocation } from './usePublicConfig';

import type { VendorsQueryData } from './vendorsQueryTypes';

export type StoresAvailabilitySnapshot = VendorsQueryData;

export function storesAvailabilityQueryKey(lng: number, lat: number) {
  return ['stores-availability', lng, lat] as const;
}

export async function fetchStoresAvailability(
  lng: number,
  lat: number,
): Promise<StoresAvailabilitySnapshot> {
  const { data, meta } = await apiRequestWithMeta<VendorsQueryData['items']>(
    `/vendors?lng=${lng}&lat=${lat}&limit=50`,
  );
  return {
    items: data,
    location: meta?.location as LocationAvailabilityMeta | undefined,
  };
}

export function useStoresAvailability() {
  const location = useAppLocation();
  return useQuery({
    queryKey: storesAvailabilityQueryKey(location.lng, location.lat),
    queryFn: () => fetchStoresAvailability(location.lng, location.lat),
    staleTime: 30_000,
  });
}
