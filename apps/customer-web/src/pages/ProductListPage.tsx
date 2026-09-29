import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { apiRequest } from '../api/client';
import { useLocale } from '../context/LocaleContext';
import { useLocationContext } from '../context/LocationContext';
import { ProductCard, type ProductSummary } from '../design-system/ProductCard';
import { ProductCardSkeleton } from '../design-system/Skeleton';
import { ErrorState } from '../design-system/ErrorState';

type Category = { _id: string; name: { en: string; ta?: string } };

export function ProductListPage() {
  const { tName } = useLocale();
  const { query } = useLocationContext();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const categoryId = params.get('categoryId');
  const q = params.get('q') ?? '';
  const [searchInput, setSearchInput] = useState(q);

  const categories = useQuery({
    queryKey: ['pl-categories'],
    queryFn: () => apiRequest<Category[]>('/categories?active=true&limit=50'),
  });

  const searchTerm = q.trim();
  const isGlobalSearch = searchTerm.length >= 2;

  useEffect(() => {
    setSearchInput(q);
  }, [q]);

  const summaries = useQuery({
    queryKey: ['product-summaries', isGlobalSearch ? 'all' : categoryId, searchTerm, query.lng, query.lat],
    queryFn: () => {
      const qs = new URLSearchParams({
        limit: '48',
        lng: String(query.lng),
        lat: String(query.lat),
      });
      if (isGlobalSearch) qs.set('q', searchTerm);
      else if (categoryId) qs.set('categoryId', categoryId);
      return apiRequest<ProductSummary[]>(`/catalog/product-summaries?${qs}`);
    },
  });

  const activeCategory = categories.data?.find((c) => c._id === categoryId);

  if (summaries.isLoading) {
    return (
      <div className="qc-grid qc-grid--products">
        {Array.from({ length: 8 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    );
  }
  if (summaries.isError) return <ErrorState onRetry={() => summaries.refetch()} />;

  const searchPlaceholder = 'Search products, brands…';

  return (
    <div className="fm-layout-split">
      <aside className="fm-sidebar qc-sidebar">
        <h3 style={{ marginTop: 0 }}>Categories</h3>
        <ul className="fm-sidebar-list">
          <li>
            <Link to="/products" className={!categoryId ? 'active' : undefined}>
              All Categories
            </Link>
          </li>
          {(categories.data ?? []).map((c) => (
            <li key={c._id}>
              <Link
                to={`/products?categoryId=${c._id}`}
                className={categoryId === c._id ? 'active' : undefined}
              >
                {tName(c.name)}
              </Link>
            </li>
          ))}
        </ul>
      </aside>
      <section>
        <form
          className="qc-search-bar qc-plp-search"
          onSubmit={(e) => {
            e.preventDefault();
            const next = new URLSearchParams();
            const term = searchInput.trim();
            if (term.length >= 2) next.set('q', term);
            else if (categoryId) next.set('categoryId', categoryId);
            navigate(`/products?${next.toString()}`);
          }}
        >
          <Search size={18} aria-hidden />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label="Search all products"
          />
        </form>
        {isGlobalSearch ? (
          <p className="qc-caption" style={{ marginTop: 0, marginBottom: 'var(--space-3)' }}>
            Showing “{searchTerm}” across all categories
          </p>
        ) : null}
        <div className="qc-chip-row qc-plp-chips">
          <Link
            to="/products"
            className={`qc-chip ${!isGlobalSearch && !categoryId ? 'is-active' : ''}`}
          >
            All
          </Link>
          {(categories.data ?? []).map((c) => (
            <Link
              key={c._id}
              to={`/products?categoryId=${c._id}`}
              className={`qc-chip ${!isGlobalSearch && categoryId === c._id ? 'is-active' : ''}`}
            >
              {tName(c.name)}
            </Link>
          ))}
        </div>
        <div className="qc-grid qc-grid--products fm-plp-grid">
          {(summaries.data ?? []).map((product) => (
            <ProductCard key={product.productId} product={product} />
          ))}
        </div>
      </section>
    </div>
  );
}
