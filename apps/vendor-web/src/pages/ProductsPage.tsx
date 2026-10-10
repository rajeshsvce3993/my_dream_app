import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ProductDetailModal } from '../components/ProductDetailModal';
import { apiRequest } from '../api/client';
import { money } from '../lib/format';

type Row = {
  id: string;
  name: string;
  sellingPrice: number;
  mrp?: number;
  isActive: boolean;
  imageUrl?: string;
  variantName?: string;
};

type Filter = 'all' | 'on' | 'off';

export function ProductsPage() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const products = useQuery({
    queryKey: ['vendor-products'],
    queryFn: () => apiRequest<Row[]>('/vendor/products'),
  });

  const rows = useMemo(() => {
    const list = products.data ?? [];
    const q = query.trim().toLowerCase();
    return list.filter((item) => {
      if (filter === 'on' && !item.isActive) return false;
      if (filter === 'off' && item.isActive) return false;
      if (!q) return true;
      const haystack = `${item.name} ${item.variantName ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [products.data, query, filter]);

  const onMenu = products.data?.filter((item) => item.isActive).length ?? 0;
  const hidden = (products.data?.length ?? 0) - onMenu;

  return (
    <div>
      <div className="vendor-page-head">
        <div>
          <h1>Menu</h1>
          <p>Manage prices and availability for dishes assigned to this shop.</p>
        </div>
      </div>

      <section className="vendor-panel data-panel">
        <div className="data-toolbar">
          <div className="data-toolbar-left">
            <label className="data-search">
              <span className="sr-only">Search menu</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search dishes…"
              />
            </label>
            <div className="period-pills" role="tablist" aria-label="Menu filter">
              {(
                [
                  ['all', `All (${products.data?.length ?? 0})`],
                  ['on', `On menu (${onMenu})`],
                  ['off', `Hidden (${hidden})`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={filter === key}
                  className={filter === key ? 'is-on' : ''}
                  onClick={() => setFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <p className="data-toolbar-meta">
            {products.isSuccess ? (
              <>
                <strong>{rows.length}</strong> shown
              </>
            ) : null}
          </p>
        </div>

        {products.isLoading ? <p className="empty">Loading products…</p> : null}
        {products.isError ? (
          <p className="error" style={{ padding: '1rem' }}>
            {(products.error as Error).message}
          </p>
        ) : null}
        {products.isSuccess && products.data.length === 0 ? (
          <p className="empty">No products yet. Admin assigns products to this shop.</p>
        ) : null}
        {products.isSuccess && products.data.length > 0 && rows.length === 0 ? (
          <p className="empty">No dishes match this search.</p>
        ) : null}

        {rows.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Dish</th>
                  <th>Variant</th>
                  <th>Status</th>
                  <th className="num">Actual price</th>
                  <th className="num">Selling price</th>
                  <th className="actions"> </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="table-product">
                        <div className="product-thumb compact">
                          {item.imageUrl ? <img src={item.imageUrl} alt="" /> : 'Food'}
                        </div>
                        <div>
                          <button type="button" className="table-link" onClick={() => setSelectedId(item.id)}>
                            {item.name}
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="muted-cell">{item.variantName?.trim() || '—'}</td>
                    <td>
                      <span className={`pill ${item.isActive ? '' : 'off'}`}>
                        {item.isActive ? 'On menu' : 'Hidden'}
                      </span>
                    </td>
                    <td className="num muted-cell">
                      {item.mrp && item.mrp > 0 ? money(item.mrp) : '—'}
                    </td>
                    <td className="num money-cell">{money(item.sellingPrice)}</td>
                    <td className="actions">
                      <button type="button" className="table-action" onClick={() => setSelectedId(item.id)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {selectedId ? <ProductDetailModal id={selectedId} onClose={() => setSelectedId(null)} /> : null}
    </div>
  );
}
