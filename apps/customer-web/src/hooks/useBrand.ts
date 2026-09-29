import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api/client';

export function useBrand() {
  const { data } = useQuery({
    queryKey: ['public-config-brand'],
    queryFn: () => apiRequest<Record<string, unknown>>('/configuration/public'),
    staleTime: 60_000,
  });

  const name = (data?.['brand.name'] as string) || 'FreshMart';
  const tagline = (data?.['brand.tagline'] as string) || '';
  const currency = (data?.['currency.symbol'] as string) || '₹';

  return { name, tagline, currency, config: data };
}
