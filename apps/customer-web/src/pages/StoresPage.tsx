import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { MapPin, Star, Clock, Store, UtensilsCrossed } from 'lucide-react';
import { apiRequest, apiRequestWithMeta } from '../api/client';
import { useLocationContext } from '../context/LocationContext';
import { useLocale } from '../context/LocaleContext';
import { EmptyState } from '../design-system/EmptyState';
import { Skeleton } from '../design-system/Skeleton';
import { formatMoney } from '../lib/format';
import { useBrand } from '../hooks/useBrand';

export type CustomerVendorCard = {
  id: string;
  name: string;
  rating: number;
  ratingCount: number;
  distanceKm?: number;
  deliveryEstimateMinutes?: number;
  deliveryFee: number;
  freeDeliveryThreshold: number;
  minimumOrderAmount: number;
  isOpen: boolean;
  productCount: number;
  offerPercent?: number;
  address?: { city?: string };
  cuisineTags?: string[];
  dietType?: 'veg' | 'nonveg' | 'both';
  imageUrl?: string;
};

type CuisineFilter = {
  id: string;
  label: { en: string; ta?: string };
  cuisineTags?: string[];
};

const DEFAULT_FILTERS: CuisineFilter[] = [{ id: 'all', label: { en: 'All', ta: 'அனைத்தும்' } }];

function vendorMatchesCuisine(store: CustomerVendorCard, chip: CuisineFilter): boolean {
  if (!chip.cuisineTags?.length) return true;
  const tags = (store.cuisineTags ?? []).map((t) => t.toLowerCase());
  return chip.cuisineTags.some((t) => tags.includes(t.toLowerCase()));
}

export function StoresPage() {
  const { query } = useLocationContext();
  const { currency } = useBrand();
  const { tName } = useLocale();
  const [activeFilter, setActiveFilter] = useState('all');

  type LocationMeta = {
    inServiceArea: boolean;
    reason: 'IN_SERVICE_AREA' | 'OUTSIDE_SERVICE_AREA' | 'NO_VENDORS_NEARBY';
    serviceAreaTitle?: string;
    serviceAreaMessage?: string;
    vendorListEmptyMessage?: string;
  };

  const config = useQuery({
    queryKey: ['public-config'],
    queryFn: () => apiRequest<Record<string, unknown>>('/configuration/public'),
  });

  const filters =
    (config.data?.['mobile.restaurants.cuisineFilters'] as CuisineFilter[] | undefined) ??
    DEFAULT_FILTERS;

  const vendors = useQuery({
    queryKey: ['vendors', query.lng, query.lat],
    queryFn: async () => {
      const { data, meta } = await apiRequestWithMeta<CustomerVendorCard[]>(
        `/vendors?lng=${query.lng}&lat=${query.lat}&limit=50`,
      );
      return { items: data, location: meta?.location as LocationMeta | undefined };
    },
  });

  const activeChip = filters.find((f) => f.id === activeFilter) ?? filters[0];
  const filtered = useMemo(() => {
    const items = vendors.data?.items ?? [];
    if (!activeChip || activeChip.id === 'all') return items;
    return items.filter((v) => vendorMatchesCuisine(v, activeChip));
  }, [activeChip, vendors.data?.items]);

  return (
    <div className="qc-stores-page">
      <header className="qc-page-header">
        <h1>Restaurants near you</h1>
        <p className="qc-caption">Same kitchens as the mobile app — filter by cuisine and open a menu.</p>
      </header>

      <div className="qc-chip-row qc-cuisine-row">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`qc-chip ${activeFilter === f.id ? 'is-active' : ''}`}
            onClick={() => setActiveFilter(f.id)}
          >
            {tName(f.label)}
          </button>
        ))}
      </div>

      {vendors.isLoading ? (
        <div className="qc-store-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} style={{ height: 220, borderRadius: 12 }} />
          ))}
        </div>
      ) : null}

      {!vendors.isLoading && !filtered.length ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="No restaurants available"
          description={
            vendors.data?.location?.vendorListEmptyMessage ??
            'Try updating your delivery location or check back later.'
          }
        />
      ) : null}

      <div className="qc-store-grid">
        {filtered.map((store) => (
          <Link key={store.id} to={`/vendors/${store.id}`} className="qc-store-card">
            <div className="qc-store-card__cover">
              {store.imageUrl ? (
                <img src={store.imageUrl} alt="" loading="lazy" />
              ) : (
                <Store size={48} strokeWidth={1.2} aria-hidden />
              )}
            </div>
            <div className="qc-store-card__body">
              <h2>{store.name}</h2>
              <div className="qc-store-card__meta">
                <span>
                  <Star size={14} aria-hidden /> {store.rating.toFixed(1)}
                </span>
                {store.distanceKm != null ? (
                  <span>
                    <MapPin size={14} aria-hidden /> {store.distanceKm.toFixed(1)} km
                  </span>
                ) : null}
                {store.deliveryEstimateMinutes ? (
                  <span>
                    <Clock size={14} aria-hidden /> {store.deliveryEstimateMinutes} min
                  </span>
                ) : null}
              </div>
              {(store.cuisineTags ?? []).length ? (
                <p className="qc-caption">{store.cuisineTags!.join(' · ')}</p>
              ) : null}
              <span className={`qc-store-status ${store.isOpen ? 'is-open' : 'is-closed'}`}>
                {store.isOpen ? 'Open' : 'Closed'}
              </span>
              <p className="qc-caption">{store.productCount} items</p>
              {store.offerPercent ? (
                <p className="qc-caption" style={{ color: '#B83A3A', fontWeight: 700 }}>
                  Up to {store.offerPercent}% off on selected orders
                </p>
              ) : store.deliveryFee > 0 ? (
                <p className="qc-caption">Delivery {formatMoney(currency, store.deliveryFee)}</p>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
