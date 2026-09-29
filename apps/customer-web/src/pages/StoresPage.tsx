import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { MapPin, Star, Clock, Store, StoreIcon } from 'lucide-react';
import { apiRequestWithMeta } from '../api/client';
import { useLocationContext } from '../context/LocationContext';
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
  address?: { city?: string };
};

export function StoresPage() {
  const { query } = useLocationContext();
  const { currency } = useBrand();

  type LocationMeta = {
    inServiceArea: boolean;
    reason: 'IN_SERVICE_AREA' | 'OUTSIDE_SERVICE_AREA' | 'NO_VENDORS_NEARBY';
    serviceAreaTitle?: string;
    serviceAreaMessage?: string;
    vendorListEmptyMessage?: string;
  };

  const vendors = useQuery({
    queryKey: ['vendors', query.lng, query.lat],
    queryFn: async () => {
      const { data, meta } = await apiRequestWithMeta<CustomerVendorCard[]>(
        `/vendors?lng=${query.lng}&lat=${query.lat}&limit=50`,
      );
      return { items: data, location: meta?.location as LocationMeta | undefined };
    },
  });

  return (
    <div className="qc-stores-page">
      <header className="qc-page-header">
        <h1>Stores near you</h1>
        <p className="qc-caption">Compare local vendors — enter a store to shop their catalog only.</p>
      </header>

      {vendors.isLoading ? (
        <div className="qc-store-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} style={{ height: 220, borderRadius: 12 }} />
          ))}
        </div>
      ) : null}

      {!vendors.isLoading && !(vendors.data?.items?.length ?? 0) ? (
        <EmptyState
          icon={StoreIcon}
          title="No stores available"
          description={
            vendors.data?.location?.vendorListEmptyMessage ??
            'Try updating your delivery location or check back later.'
          }
        />
      ) : null}

      <div className="qc-store-grid">
        {(vendors.data?.items ?? []).map((store) => (
          <Link key={store.id} to={`/vendors/${store.id}`} className="qc-store-card">
            <div className="qc-store-card__cover">
              <Store size={48} strokeWidth={1.2} aria-hidden />
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
              <span className={`qc-store-status ${store.isOpen ? 'is-open' : 'is-closed'}`}>
                {store.isOpen ? 'Open' : 'Closed'}
              </span>
              <p className="qc-caption">
                {store.productCount} products · Min order {formatMoney(currency, store.minimumOrderAmount)}
              </p>
              {store.freeDeliveryThreshold > 0 ? (
                <p className="qc-store-offer">
                  Free delivery above {formatMoney(currency, store.freeDeliveryThreshold)}
                </p>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
