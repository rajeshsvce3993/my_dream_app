import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { ArrowLeft, MapPin, PackageOpen, Search, Star } from 'lucide-react';
import { apiRequest } from '../api/client';
import { useLocationContext } from '../context/LocationContext';
import { VendorProductCard, type VendorStoreProduct } from '../design-system/VendorProductCard';
import { EmptyState } from '../design-system/EmptyState';
import type { CustomerVendorCard } from './StoresPage';

type VendorProductsResponse = {
  products: VendorStoreProduct[];
  categories: Array<{ id: string; name: { en: string; ta?: string } }>;
};

export function VendorStorePage() {
  const { vendorId } = useParams();
  const { query } = useLocationContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchParams.get('search') ?? '');
  const categoryId = searchParams.get('categoryId') ?? '';
  const sort = searchParams.get('sort') ?? 'recommended';
  const search = searchParams.get('search') ?? '';

  const vendor = useQuery({
    queryKey: ['vendor', vendorId, query.lng, query.lat],
    queryFn: () =>
      apiRequest<CustomerVendorCard>(`/vendors/${vendorId}?lng=${query.lng}&lat=${query.lat}`),
    enabled: Boolean(vendorId),
  });

  const products = useInfiniteQuery({
    queryKey: ['vendor-products', vendorId, categoryId, sort, search, query.lng, query.lat],
    queryFn: ({ pageParam = 1 }) => {
      const params = new URLSearchParams({
        page: String(pageParam),
        limit: '20',
        lng: String(query.lng),
        lat: String(query.lat),
        sort,
      });
      if (categoryId) params.set('categoryId', categoryId);
      if (search) params.set('search', search);
      return apiRequest<VendorProductsResponse>(`/vendors/${vendorId}/products?${params}`);
    },
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (last.products.length >= 20 ? pages.length + 1 : undefined),
    enabled: Boolean(vendorId),
  });

  const categories = products.data?.pages[0]?.categories ?? [];
  const allProducts = useMemo(
    () => products.data?.pages.flatMap((p) => p.products) ?? [],
    [products.data],
  );

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams(searchParams);
    if (searchInput.trim()) next.set('search', searchInput.trim());
    else next.delete('search');
    setSearchParams(next);
  }

  return (
    <div className="qc-vendor-store">
      <Link to="/stores" className="qc-back-link">
        <ArrowLeft size={18} /> All stores
      </Link>

      {vendor.data ? (
        <header className="qc-vendor-hero">
          <div className="qc-vendor-hero__logo">{vendor.data.name.slice(0, 1)}</div>
          <div>
            <h1>{vendor.data.name}</h1>
            <div className="qc-store-card__meta">
              <span>
                <Star size={14} /> {vendor.data.rating.toFixed(1)}
              </span>
              {vendor.data.distanceKm != null ? (
                <span>
                  <MapPin size={14} /> {vendor.data.distanceKm.toFixed(1)} km
                </span>
              ) : null}
              {vendor.data.deliveryEstimateMinutes ? (
                <span>{vendor.data.deliveryEstimateMinutes} min delivery</span>
              ) : null}
              <span className={`qc-store-status ${vendor.data.isOpen ? 'is-open' : 'is-closed'}`}>
                {vendor.data.isOpen ? 'Open' : 'Closed'}
              </span>
            </div>
          </div>
        </header>
      ) : null}

      <form className="qc-search-bar qc-vendor-search" onSubmit={applySearch}>
        <Search size={18} aria-hidden />
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search this store"
          aria-label="Search this store"
        />
      </form>

      <div className="qc-chip-row">
        <button
          type="button"
          className={`qc-chip ${!categoryId ? 'is-active' : ''}`}
          onClick={() => {
            const next = new URLSearchParams(searchParams);
            next.delete('categoryId');
            setSearchParams(next);
          }}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`qc-chip ${categoryId === c.id ? 'is-active' : ''}`}
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.set('categoryId', c.id);
              setSearchParams(next);
            }}
          >
            {c.name.en}
          </button>
        ))}
      </div>

      <div className="qc-sort-row">
        {[
          ['recommended', 'Recommended'],
          ['popular', 'Popular'],
          ['price_low_to_high', 'Price ↑'],
          ['discount', 'Best deals'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`qc-chip qc-chip--sm ${sort === value ? 'is-active' : ''}`}
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.set('sort', value);
              setSearchParams(next);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {!products.isLoading && !allProducts.length ? (
        <EmptyState
          icon={PackageOpen}
          title="No products"
          description="Nothing matched your filters in this store."
        />
      ) : null}

      <div className="qc-product-grid">
        {allProducts.map((p) => (
          <VendorProductCard key={p.vendorProductId} product={p} vendorId={vendorId!} />
        ))}
      </div>

      {products.hasNextPage ? (
        <button
          type="button"
          className="btn btn--ghost qc-load-more"
          disabled={products.isFetchingNextPage}
          onClick={() => products.fetchNextPage()}
        >
          {products.isFetchingNextPage ? 'Loading…' : 'Load more'}
        </button>
      ) : null}
    </div>
  );
}
