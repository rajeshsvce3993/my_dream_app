import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PackageSearch, Search } from 'lucide-react';
import { apiRequest } from '../api/client';
import { useLocale } from '../context/LocaleContext';
import { EmptyState } from '../design-system/EmptyState';
import { ProductCard, type ProductSummary } from '../design-system/ProductCard';
import { useLocationContext } from '../context/LocationContext';
import { useQuickAddToCart } from '../lib/useQuickAddToCart';

type SuggestResult = {
  suggestions?: Array<
    | { type: 'product'; id: string; label: { en: string; ta?: string } }
    | { type: 'category'; id: string; label: { en: string; ta?: string } }
    | string
  >;
  popular?: string[];
};

export function SearchPage() {
  const { tName } = useLocale();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initial = params.get('q') ?? '';
  const mode = params.get('mode');
  const titleParam = params.get('title');
  const dietFilter =
    params.get('diet') === 'veg' || params.get('diet') === 'nonveg'
      ? (params.get('diet') as 'veg' | 'nonveg')
      : undefined;
  const topPickMode = mode === 'topPick' || Boolean(titleParam?.trim());
  const [q, setQ] = useState(initial);
  const [committedQ, setCommittedQ] = useState(topPickMode ? initial.trim() : initial.trim());
  const debounced = useMemo(() => committedQ.trim(), [committedQ]);
  const { query } = useLocationContext();
  const quickAdd = useQuickAddToCart();

  useEffect(() => {
    setQ(initial);
    setCommittedQ(initial.trim());
  }, [initial, mode, titleParam]);

  useEffect(() => {
    if (topPickMode) return;
    const t = setTimeout(() => setCommittedQ(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q, topPickMode]);

  const suggest = useQuery({
    queryKey: ['search-suggest', debounced],
    queryFn: () =>
      apiRequest<SuggestResult>(`/catalog/search-suggest?q=${encodeURIComponent(debounced)}`),
    enabled: !topPickMode && debounced.length < 2,
  });

  const products = useQuery({
    queryKey: ['dish-offers', debounced, query.lng, query.lat, dietFilter],
    queryFn: () => {
      const qs = new URLSearchParams({
        limit: '60',
        q: debounced,
        lng: String(query.lng),
        lat: String(query.lat),
      });
      if (dietFilter) qs.set('diet', dietFilter);
      return apiRequest<ProductSummary[]>(`/catalog/dish-offers?${qs}`);
    },
    enabled: debounced.length >= 2,
  });

  const pageTitle = topPickMode && titleParam?.trim() ? titleParam.trim() : 'Search';

  async function onAdd(p: ProductSummary) {
    const added = await quickAdd.mutate(p);
    if (added && topPickMode && p.recommendedVendorId) {
      navigate(`/vendors/${p.recommendedVendorId}`);
    }
  }

  return (
    <div className="qc-search-page">
      <h1 className="qc-greeting" style={{ fontSize: '1.35rem' }}>
        {pageTitle}
      </h1>
      {dietFilter ? (
        <p className="qc-caption" style={{ marginBottom: 12 }}>
          Showing {dietFilter === 'veg' ? 'veg' : 'non-veg'} options
        </p>
      ) : null}

      {!topPickMode ? (
        <form
          className="qc-search-bar qc-search-bar--page"
          onSubmit={(e) => {
            e.preventDefault();
            setCommittedQ(q.trim());
            navigate(`/search?q=${encodeURIComponent(q.trim())}`);
          }}
        >
          <Search size={20} aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search dishes, restaurants…"
            aria-label="Search"
            autoFocus
          />
        </form>
      ) : null}

      {!topPickMode && debounced.length < 2 ? (
        <div className="qc-search-chips">
          <p className="qc-caption">Popular searches</p>
          <div className="qc-chip-row">
            {(suggest.data?.popular ?? []).map((term) => (
              <button
                key={term}
                type="button"
                className="qc-chip"
                onClick={() => {
                  setQ(term);
                  setCommittedQ(term);
                  navigate(`/search?q=${encodeURIComponent(term)}`);
                }}
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {!topPickMode && debounced.length >= 2 && suggest.data?.suggestions?.length ? (
        <ul className="qc-suggest-list">
          {suggest.data.suggestions.map((s, i) => {
            if (typeof s === 'string') {
              return (
                <li key={`${s}-${i}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setQ(s);
                      setCommittedQ(s);
                    }}
                  >
                    {s}
                  </button>
                </li>
              );
            }
            return (
              <li key={`${s.type}-${s.id}`}>
                <Link
                  to={s.type === 'product' ? `/products/${s.id}` : `/products?categoryId=${s.id}`}
                >
                  {tName(s.label)}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}

      {debounced.length >= 2 && products.data?.length === 0 && !products.isLoading ? (
        <EmptyState
          icon={PackageSearch}
          title="We couldn't find that"
          description="Try another dish or browse restaurants."
          actionLabel="Browse restaurants"
          actionTo="/restaurants"
        />
      ) : null}

      {products.isLoading ? <p className="qc-caption">Finding dishes near you…</p> : null}

      {products.data?.length ? (
        <div className="qc-grid qc-grid--products">
          {products.data.map((p) => (
            <ProductCard
              key={`${p.productId}-${p.recommendedVendorId ?? p.vendorId ?? ''}`}
              product={p}
              onAdd={() => void onAdd(p)}
              adding={quickAdd.isAddingProduct(p.productId, p.recommendedVendorId ?? p.vendorId)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
