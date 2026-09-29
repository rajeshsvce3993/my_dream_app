import { useQuery } from '@tanstack/react-query';
import { loadDeliveryLocation } from './deliveryLocation';
import type { AppLocation } from './location';

export function useDeliveryAddress(): {
  location: AppLocation | null;
  hasSavedAddress: boolean;
  isLoading: boolean;
} {
  const saved = useQuery({
    queryKey: ['delivery-location'],
    queryFn: loadDeliveryLocation,
    staleTime: 30_000,
  });
  return {
    location: saved.data ?? null,
    hasSavedAddress: Boolean(saved.data),
    isLoading: saved.isLoading,
  };
}
