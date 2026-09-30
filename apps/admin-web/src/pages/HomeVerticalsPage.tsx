import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiRequest } from '../api/client';

type HomeVertical = {
  id: string;
  label: { en: string; ta?: string };
  subtitle?: { en: string; ta?: string };
  icon: string;
  webIcon?: string;
  enabled: boolean;
  isPrimary?: boolean;
  status: 'live' | 'coming_soon';
  href: string;
  categorySlug?: string;
  sortOrder: number;
};

const CONFIG_KEY = 'home.verticals';

export function HomeVerticalsPage() {
  const qc = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);

  const config = useQuery({
    queryKey: ['configuration'],
    queryFn: () => apiRequest<Array<{ key: string; value: unknown }>>('/configuration'),
  });

  const verticals = useMemo(() => {
    const row = (config.data ?? []).find((c) => c.key === CONFIG_KEY);
    return (row?.value as HomeVertical[] | undefined) ?? [];
  }, [config.data]);

  const save = useMutation({
    mutationFn: (value: HomeVertical[]) =>
      apiRequest<null>(`/configuration/${encodeURIComponent(CONFIG_KEY)}`, {
        method: 'PATCH',
        body: JSON.stringify({ value }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['configuration'] });
      setMessage('Saved — customer apps will pick this up on next refresh.');
    },
    onError: (err: Error) => setMessage(err.message),
  });

  function patchVertical(id: string, patch: Partial<HomeVertical>) {
    const next = verticals.map((v) => (v.id === id ? { ...v, ...patch } : v));
    save.mutate(next);
  }

  function moveVertical(id: string, dir: -1 | 1) {
    const sorted = [...verticals].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((v) => v.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= sorted.length) return;
    const a = sorted[idx]!;
    const b = sorted[swap]!;
    const next = verticals.map((v) => {
      if (v.id === a.id) return { ...v, sortOrder: b.sortOrder };
      if (v.id === b.id) return { ...v, sortOrder: a.sortOrder };
      return v;
    });
    save.mutate(next);
  }

  if (config.isLoading) return <p>Loading…</p>;
  if (config.isError) return <p className="error">{(config.error as Error).message}</p>;

  const sorted = [...verticals].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div>
      <h1>Home verticals</h1>
      <p style={{ maxWidth: 720, marginBottom: 16 }}>
        Control which business lines appear on the customer home screen (mobile & web).{' '}
        <strong>Food</strong> should stay primary and live; enable groceries when ready; keep electronics, fashion,
        and gifts as <em>coming soon</em> until marketplace flows ship. Raw JSON also lives under{' '}
        <a href="/configuration">Configuration</a> (<code>{CONFIG_KEY}</code>).
      </p>
      {message ? <p>{message}</p> : null}
      <table>
        <thead>
          <tr>
            <th>Order</th>
            <th>ID</th>
            <th>Label (EN)</th>
            <th>Primary</th>
            <th>Enabled</th>
            <th>Status</th>
            <th>Link</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((v, i) => (
            <tr key={v.id}>
              <td>
                <button type="button" disabled={i === 0 || save.isPending} onClick={() => moveVertical(v.id, -1)}>
                  ↑
                </button>
                <button
                  type="button"
                  disabled={i === sorted.length - 1 || save.isPending}
                  onClick={() => moveVertical(v.id, 1)}
                >
                  ↓
                </button>
              </td>
              <td>
                <code>{v.id}</code>
              </td>
              <td>{v.label.en}</td>
              <td>
                <input
                  type="radio"
                  name="primary"
                  checked={Boolean(v.isPrimary)}
                  disabled={save.isPending}
                  onChange={() => {
                    const next = verticals.map((row) => ({
                      ...row,
                      isPrimary: row.id === v.id,
                    }));
                    save.mutate(next);
                  }}
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={v.enabled}
                  disabled={save.isPending}
                  onChange={(e) => patchVertical(v.id, { enabled: e.target.checked })}
                />
              </td>
              <td>
                <select
                  value={v.status}
                  disabled={save.isPending}
                  onChange={(e) => patchVertical(v.id, { status: e.target.value as HomeVertical['status'] })}
                >
                  <option value="live">live</option>
                  <option value="coming_soon">coming_soon</option>
                </select>
              </td>
              <td>
                <code>{v.href}</code>
                {v.categorySlug ? (
                  <div style={{ fontSize: 11, color: '#666' }}>category: {v.categorySlug}</div>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
