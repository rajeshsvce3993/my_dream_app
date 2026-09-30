import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiRequest } from '../api/client';

type TopPick = {
  id: string;
  label: { en: string; ta?: string };
  imageUrl?: string;
  searchQuery: string;
  diet?: 'veg' | 'nonveg' | 'both';
  enabled: boolean;
  sortOrder: number;
};

const CONFIG_KEY = 'home.topPicks';

const emptyDraft = (): TopPick => ({
  id: `pick-${Date.now()}`,
  label: { en: '' },
  searchQuery: '',
  imageUrl: '',
  diet: 'both',
  enabled: true,
  sortOrder: 0,
});

export function HomeTopPicksPage() {
  const qc = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState<TopPick | null>(null);

  const config = useQuery({
    queryKey: ['configuration'],
    queryFn: () => apiRequest<Array<{ key: string; value: unknown }>>('/configuration'),
  });

  const picks = useMemo(() => {
    const row = (config.data ?? []).find((c) => c.key === CONFIG_KEY);
    return (row?.value as TopPick[] | undefined) ?? [];
  }, [config.data]);

  const save = useMutation({
    mutationFn: (value: TopPick[]) =>
      apiRequest<null>(`/configuration/${encodeURIComponent(CONFIG_KEY)}`, {
        method: 'PATCH',
        body: JSON.stringify({ value }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['configuration'] });
      setMessage('Saved — customer apps refresh on next load.');
      setDraft(null);
    },
    onError: (err: Error) => setMessage(err.message),
  });

  function persist(next: TopPick[]) {
    save.mutate(next.map((p, i) => ({ ...p, sortOrder: p.sortOrder ?? i })));
  }

  function upsertDraft() {
    if (!draft) return;
    const label = draft.label.en.trim();
    const q = draft.searchQuery.trim();
    if (!label || !q) {
      setMessage('Label (EN) and search query are required.');
      return;
    }
    const id = draft.id.trim() || label.toLowerCase().replace(/\s+/g, '-');
    const item: TopPick = {
      ...draft,
      id,
      label: { en: label, ta: draft.label.ta?.trim() || undefined },
      searchQuery: q,
      imageUrl: draft.imageUrl?.trim() || undefined,
    };
    const exists = picks.some((p) => p.id === id);
    const next = exists ? picks.map((p) => (p.id === id ? item : p)) : [...picks, item];
    persist(next);
  }

  function removePick(id: string) {
    if (!window.confirm('Remove this top pick?')) return;
    persist(picks.filter((p) => p.id !== id));
  }

  function movePick(id: string, dir: -1 | 1) {
    const sorted = [...picks].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((p) => p.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= sorted.length) return;
    const a = sorted[idx]!;
    const b = sorted[swap]!;
    persist(
      picks.map((p) => {
        if (p.id === a.id) return { ...p, sortOrder: b.sortOrder };
        if (p.id === b.id) return { ...p, sortOrder: a.sortOrder };
        return p;
      }),
    );
  }

  if (config.isLoading) return <p>Loading…</p>;
  if (config.isError) return <p className="error">{(config.error as Error).message}</p>;

  const sorted = [...picks].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div>
      <h1>Top picks</h1>
      <p style={{ maxWidth: 720, marginBottom: 16 }}>
        Dish shortcuts on the customer home screen (Biryani, Fried rice, Chicken 65, …). Customers tap a
        pick to search restaurants / menus. Config key: <code>{CONFIG_KEY}</code>.
      </p>
      {message ? <p>{message}</p> : null}

      <div style={{ marginBottom: 20 }}>
        <button type="button" disabled={save.isPending} onClick={() => setDraft(emptyDraft())}>
          + Add top pick
        </button>
      </div>

      {draft ? (
        <section
          style={{
            marginBottom: 24,
            padding: 16,
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            maxWidth: 560,
            display: 'grid',
            gap: 10,
          }}
        >
          <h3 style={{ margin: 0 }}>{picks.some((p) => p.id === draft.id) ? 'Edit' : 'New'} pick</h3>
          <label>
            ID{' '}
            <input
              value={draft.id}
              onChange={(e) => setDraft({ ...draft, id: e.target.value })}
              style={{ width: '100%' }}
            />
          </label>
          <label>
            Label (EN){' '}
            <input
              value={draft.label.en}
              onChange={(e) => setDraft({ ...draft, label: { ...draft.label, en: e.target.value } })}
              style={{ width: '100%' }}
            />
          </label>
          <label>
            Search query{' '}
            <input
              value={draft.searchQuery}
              onChange={(e) => setDraft({ ...draft, searchQuery: e.target.value })}
              placeholder="biryani"
              style={{ width: '100%' }}
            />
          </label>
          <label>
            Image URL{' '}
            <input
              value={draft.imageUrl ?? ''}
              onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })}
              style={{ width: '100%' }}
            />
          </label>
          <label>
            Diet{' '}
            <select
              value={draft.diet ?? 'both'}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  diet: e.target.value as 'veg' | 'nonveg' | 'both',
                })
              }
              style={{ width: '100%' }}
            >
              <option value="both">Both</option>
              <option value="veg">Veg</option>
              <option value="nonveg">Non-veg</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
            />{' '}
            Enabled
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" disabled={save.isPending} onClick={upsertDraft}>
              Save
            </button>
            <button type="button" onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      <table>
        <thead>
          <tr>
            <th>Order</th>
            <th>Image</th>
            <th>Label</th>
            <th>Search</th>
            <th>Diet</th>
            <th>Enabled</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {sorted.map((p, i) => (
            <tr key={p.id}>
              <td>
                <button type="button" disabled={i === 0 || save.isPending} onClick={() => movePick(p.id, -1)}>
                  ↑
                </button>
                <button
                  type="button"
                  disabled={i === sorted.length - 1 || save.isPending}
                  onClick={() => movePick(p.id, 1)}
                >
                  ↓
                </button>
              </td>
              <td>
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt="" width={40} height={40} style={{ borderRadius: 8, objectFit: 'cover' }} />
                ) : (
                  '—'
                )}
              </td>
              <td>{p.label.en}</td>
              <td>
                <code>{p.searchQuery}</code>
              </td>
              <td>{p.diet ?? 'both'}</td>
              <td>
                <input
                  type="checkbox"
                  checked={p.enabled}
                  disabled={save.isPending}
                  onChange={(e) =>
                    persist(picks.map((row) => (row.id === p.id ? { ...row, enabled: e.target.checked } : row)))
                  }
                />
              </td>
              <td>
                <button type="button" onClick={() => setDraft({ ...p })}>
                  Edit
                </button>{' '}
                <button type="button" onClick={() => removePick(p.id)}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
