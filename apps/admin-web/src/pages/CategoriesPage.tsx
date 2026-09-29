import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiRequest } from '../api/client';

type Category = {
  _id: string;
  slug: string;
  name: { en: string; ta?: string };
  isActive: boolean;
};

export function CategoriesPage() {
  const qc = useQueryClient();
  const [en, setEn] = useState('');
  const [ta, setTa] = useState('');
  const [slug, setSlug] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiRequest<Category[]>('/categories?limit=100'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest('/categories', {
        method: 'POST',
        body: JSON.stringify({ slug, name: { en, ta: ta || undefined }, isActive: true }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      setEn('');
      setTa('');
      setSlug('');
    },
  });

  return (
    <div>
      <h1>Categories</h1>
      <div className="card form-grid" style={{ margin: '1rem 0' }}>
        <h2>Create category</h2>
        <input placeholder="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
        <input placeholder="English name" value={en} onChange={(e) => setEn(e.target.value)} />
        <input placeholder="Tamil name" value={ta} onChange={(e) => setTa(e.target.value)} />
        <button onClick={() => createMutation.mutate()} disabled={!slug || !en || createMutation.isPending}>
          Create
        </button>
      </div>
      {isLoading ? (
        <p>Loading…</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Slug</th>
              <th>English</th>
              <th>Tamil</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((c) => (
              <tr key={c._id}>
                <td>{c.slug}</td>
                <td>{c.name.en}</td>
                <td>{c.name.ta ?? '—'}</td>
                <td>{c.isActive ? 'Active' : 'Inactive'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
