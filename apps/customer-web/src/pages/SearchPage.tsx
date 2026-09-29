import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { apiRequest } from '../api/client';
import { useLocale } from '../context/LocaleContext';
import { EmptyState } from '../design-system/EmptyState';
import { ProductCard, type ProductSummary } from '../design-system/ProductCard';
import { PackageSearch } from 'lucide-react';
import { useLocationContext } from '../context/LocationContext';

type SuggestResult = {
  suggestions: Array<
    | { type: 'product'; id: string; label: { en: string; ta?: string } }
    | { type: 'category'; id: string; label: { en: string; ta?: string } }
  >;
  popular: string[];
};

export function SearchPage() {
  const { tName } = useLocale();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initial = params.get('q') ?? '';
  const [q, setQ] = useState(initial);
  const debounced = useMemo(() => q.trim(), [q]);
  const { query } = useLocationContext();

  const suggest = useQuery({
    queryKey: ['search-suggest', debounced],
    queryFn: () => apiRequest<SuggestResult>(`/catalog/search-suggest?q=${encodeURIComponent(debounced)}`),
    enabled: debounced.length >= 0,
  });

  const products = useQuery({
    queryKey: ['search-products', debounced],
    queryFn: () =>
      apiRequest<ProductSummary[]>(
        `/catalog/product-summaries?limit=24&q=${encodeURIComponent(debounced)}&lng=${query.lng}&lat=${query.lat}`,
      ),
    enabled: debounced.length >= 2,
  });

  return (
    <div className="qc-search-page">
      <form
        className="qc-search-bar qc-search-bar--page"
        onSubmit={(e) => {
          e.preventDefault();
          navigate(`/search?q=${encodeURIComponent(q)}`);
        }}
      >
        <Search size={20} aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search products, brands, categories…"
          aria-label="Search"
          autoFocus
        />
      </form>

      {debounced.length < 2 ? (
        <div className="qc-search-chips">
          <p className="qc-caption">Popular searches</p>
          <div className="qc-chip-row">
            {(suggest.data?.popular ?? []).map((term) => (
              <button key={term} type="button" className="qc-chip" onClick={() => setQ(term)}>
                {term}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {debounced.length >= 2 && suggest.data?.suggestions.length ? (
        <ul className="qc-suggest-list">
          {suggest.data.suggestions.map((s) => (
            <li key={`${s.type}-${s.id}`}>
              <Link
                to={s.type === 'product' ? `/products/${s.id}` : `/products?categoryId=${s.id}`}
              >
                {tName(s.label)}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {debounced.length >= 2 && products.data?.length === 0 && !products.isLoading ? (
        <EmptyState
          icon={PackageSearch}
          title="We couldn't find that"
          description="Try another search or browse categories."
          actionLabel="Browse categories"
          actionTo="/products"
        />
      ) : null}

      {products.data?.length ? (
        <div className="qc-grid qc-grid--products">
          {products.data.map((p) => (
            <ProductCard key={p.productId} product={p} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
