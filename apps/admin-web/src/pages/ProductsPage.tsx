import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiRequest } from '../api/client';

type Product = {
  _id: string;
  sku: string;
  name: { en: string; ta?: string };
  status: string;
};

export function ProductsPage() {
  const qc = useQueryClient();
  const [sku, setSku] = useState('');
  const [slug, setSlug] = useState('');
  const [en, setEn] = useState('');
  const [ta, setTa] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiRequest<Array<{ _id: string; name: { en: string } }>>('/categories?limit=100'),
  });

  const products = useQuery({
    queryKey: ['products'],
    queryFn: () => apiRequest<Product[]>('/products?limit=100'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest('/products', {
        method: 'POST',
        body: JSON.stringify({
          sku,
          slug,
          name: { en, ta: ta || undefined },
          categoryId,
          status: 'ACTIVE',
        }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });

  return (
    <div>
      <h1>Products</h1>
      <div className="card form-grid" style={{ margin: '1rem 0' }}>
        <h2>Create product</h2>
        <input placeholder="SKU" value={sku} onChange={(e) => setSku(e.target.value)} />
        <input placeholder="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
        <input placeholder="English name" value={en} onChange={(e) => setEn(e.target.value)} />
        <input placeholder="Tamil name" value={ta} onChange={(e) => setTa(e.target.value)} />
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Select category</option>
          {(categories.data ?? []).map((c) => (
            <option key={c._id} value={c._id}>
              {c.name.en}
            </option>
          ))}
        </select>
        <button
          onClick={() => createMutation.mutate()}
          disabled={!sku || !slug || !en || !categoryId || createMutation.isPending}
        >
          Create
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
