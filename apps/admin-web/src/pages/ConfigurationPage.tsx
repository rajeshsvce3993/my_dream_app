import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api/client';

type ConfigItem = {
  key: string;
  value: unknown;
  category: string;
  isPublic: boolean;
  description?: string;
};

export function ConfigurationPage() {
  const qc = useQueryClient();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['configuration'],
    queryFn: () => apiRequest<ConfigItem[]>('/configuration'),
  });

  const save = useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) =>
      apiRequest<null>(`/configuration/${encodeURIComponent(key)}`, {
        method: 'PATCH',
        body: JSON.stringify({ value }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['configuration'] });
      setEditingKey(null);
      setSaveError(null);
    },
    onError: (err: Error) => setSaveError(err.message),
  });

  function startEdit(item: ConfigItem) {
    setEditingKey(item.key);
    setDraft(JSON.stringify(item.value, null, 2));
    setSaveError(null);
  }

  function submitEdit(key: string) {
    try {
      const value = JSON.parse(draft) as unknown;
      save.mutate({ key, value });
    } catch {
      setSaveError('Invalid JSON');
    }
  }

  if (isLoading) return <p>Loading configuration…</p>;
  if (error) return <p className="error">{(error as Error).message}</p>;

  const grouped = (data ?? []).reduce<Record<string, ConfigItem[]>>((acc, item) => {
    (acc[item.category] ??= []).push(item);
    return acc;
  }, {});

  return (
    <div>
      <h1>Configuration</h1>
      <p style={{ maxWidth: 720, marginBottom: 24 }}>
        Public keys are exposed to the customer web and mobile apps via{' '}
        <code>/configuration/public</code>. Home layout, promos, and mobile copy are driven by{' '}
        <code>home.*</code> and <code>mobile.*</code> keys. Customer OTP is configured under{' '}
        <strong>auth</strong> via <code>otp.settings</code> (provider, MSG91, limits). Secrets are redacted in
        this UI and are never exposed to mobile apps. Platform delivery zones (multiple lat/lng + radius) are
        managed on the <Link to="/delivery">Delivery</Link> page (<code>delivery.serviceAreas</code>); per-store
        radius is on <Link to="/vendors">Vendors</Link>.
      </p>
      {saveError ? <p className="error">{saveError}</p> : null}
      {Object.entries(grouped).map(([category, items]) => (
        <section key={category} style={{ marginBottom: 32 }}>
          <h2 style={{ textTransform: 'capitalize' }}>{category}</h2>
          <table>
            <thead>
              <tr>
                <th>Key</th>
                <th>Value</th>
                <th>Public</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.key}>
                  <td>
                    <code>{item.key}</code>
                    {item.description ? (
                      <div style={{ fontSize: 12, color: '#666' }}>{item.description}</div>
                    ) : null}
                  </td>
                  <td style={{ maxWidth: 480 }}>
                    {editingKey === item.key && item.key === 'home.sections' ? (
                      <p style={{ fontSize: 12, color: '#555', marginBottom: 8, maxWidth: 480 }}>
                        <strong>Top Deals:</strong> use a <code>product_row</code> section with{' '}
                        <code>enabled: true</code>, set <code>title</code>, and <code>config.skus</code> (product SKU
                        list) or <code>config.categorySlug</code>. Optional <code>config.viewAllCategorySlug</code>,{' '}
                        <code>config.viewAllPath</code>, and <code>config.viewAllLabel</code> for the header link.{' '}
                        <strong>Home categories:</strong>{' '}
                        <code>category_shortcuts</code> with <code>config.slugs</code> and optional{' '}
                        <code>defaultSubcategorySlugByParent</code> for listing deep links.
                      </p>
                    ) : null}
                    {editingKey === item.key ? (
                      <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        rows={item.key === 'home.sections' ? 18 : 8}
                        style={{ width: '100%', fontFamily: 'monospace', fontSize: 12 }}
                      />
                    ) : (
                      <code style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {JSON.stringify(item.value)}
                      </code>
                    )}
                  </td>
                  <td>{item.isPublic ? 'Yes' : 'No'}</td>
                  <td>
                    {editingKey === item.key ? (
                      <>
                        <button type="button" onClick={() => submitEdit(item.key)} disabled={save.isPending}>
                          Save
                        </button>{' '}
                        <button type="button" onClick={() => setEditingKey(null)}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={() => startEdit(item)}>
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
