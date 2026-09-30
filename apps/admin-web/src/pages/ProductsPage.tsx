import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiRequest } from '../api/client';

type Product = {
  _id: string;
  sku: string;
  name: { en: string; ta?: string };
  status: string;
};

type Category = { _id: string; name: { en: string }; slug?: string };

export function ProductsPage() {
  const qc = useQueryClient();
  const [sku, setSku] = useState('');
  const [slug, setSlug] = useState('');
  const [en, setEn] = useState('');
  const [ta, setTa] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [variantName, setVariantName] = useState('1 serving');
  const [listPrice, setListPrice] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formOk, setFormOk] = useState<string | null>(null);

  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiRequest<Category[]>('/categories?limit=200'),
  });

  const products = useQuery({
    queryKey: ['products'],
    queryFn: () => apiRequest<Product[]>('/products?limit=200'),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const product = await apiRequest<{ _id: string; sku: string }>('/products', {
        method: 'POST',
        body: JSON.stringify({
          sku: sku.trim().toUpperCase(),
          slug: (slug.trim() || sku.trim()).toLowerCase().replace(/\s+/g, '-'),
          name: { en: en.trim(), ta: ta.trim() || undefined },
          categoryId,
          status: 'ACTIVE',
          images: imageUrl.trim()
            ? [{ url: imageUrl.trim(), isPrimary: true, sortOrder: 0 }]
            : undefined,
        }),
      });

      await apiRequest(`/products/${product._id}/variants`, {
        method: 'POST',
        body: JSON.stringify({
          sku: `${sku.trim().toUpperCase()}-V1`,
          name: { en: variantName.trim() || '1 serving' },
          listPrice: listPrice ? Number(listPrice) : undefined,
          status: 'ACTIVE',
        }),
      });

      return product;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      setSku('');
      setSlug('');
      setEn('');
      setTa('');
      setCategoryId('');
      setImageUrl('');
      setVariantName('1 serving');
      setListPrice('');
      setFormError(null);
      setFormOk('Product + variant created. Assign it to a restaurant under Vendors → Manage → Products.');
    },
    onError: (err: Error) => {
      setFormOk(null);
      setFormError(err.message);
    },
  });

  return (
    <div>
      <h1>Products</h1>
      <p style={{ maxWidth: 720, color: 'var(--fm-muted)', marginBottom: 16 }}>
        Create dishes/products here (stored in DB). Then open a restaurant under{' '}
        <strong>Vendors</strong> and map the product with that restaurant&apos;s selling price and MRP
        (discount % is calculated from MRP − selling price).
      </p>

      <div className="panel form-grid" style={{ marginBottom: 24 }}>
        <h2>Create product (with variant)</h2>
        <label>
          SKU
          <input placeholder="FOOD-SI-IDLI" value={sku} onChange={(e) => setSku(e.target.value)} />
        </label>
        <label>
          Slug
          <input
            placeholder="auto from sku if empty"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
        </label>
        <label>
          English name
          <input placeholder="Soft Idli (4 pcs)" value={en} onChange={(e) => setEn(e.target.value)} />
        </label>
        <label>
          Tamil name
          <input placeholder="இட்லி" value={ta} onChange={(e) => setTa(e.target.value)} />
        </label>
        <label>
          Category
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Select category</option>
            {(categories.data ?? []).map((c) => (
              <option key={c._id} value={c._id}>
                {c.name.en}
                {c.slug ? ` (${c.slug})` : ''}
              </option>
            ))}
          </select>
        </label>
        <label>
          Image URL
          <input
            placeholder="https://…"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
        </label>
        <label>
          Default variant name
          <input value={variantName} onChange={(e) => setVariantName(e.target.value)} />
        </label>
        <label>
          List / reference MRP (optional)
          <input
            inputMode="decimal"
            placeholder="120"
            value={listPrice}
            onChange={(e) => setListPrice(e.target.value)}
          />
        </label>
        {formError ? <p className="error" style={{ gridColumn: '1 / -1' }}>{formError}</p> : null}
        {formOk ? (
          <p style={{ gridColumn: '1 / -1', color: 'green' }}>{formOk}</p>
        ) : null}
        <button
          type="button"
          className="btn"
          onClick={() => createMutation.mutate()}
          disabled={!sku || !en || !categoryId || createMutation.isPending}
        >
          {createMutation.isPending ? 'Creating…' : 'Create product'}
        </button>
      </div>

      <table>
        <thead>
          <tr>
            <th>SKU</th>
            <th>English</th>
            <th>Tamil</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {(products.data ?? []).map((p) => (
            <tr key={p._id}>
              <td>{p.sku}</td>
              <td>{p.name.en}</td>
              <td>{p.name.ta ?? '—'}</td>
              <td>{p.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
