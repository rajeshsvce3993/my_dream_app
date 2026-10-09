import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../api/client';

type ConfigItem = { key: string; value: unknown };

type FormState = {
  baseKm: string;
  baseCharge: string;
  perKmCharge: string;
};

const EMPTY: FormState = {
  baseKm: '3',
  baseCharge: '0',
  perKmCharge: '0',
};

function numberValue(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formFromConfig(rows: ConfigItem[]): FormState {
  const saved = rows.find((row) => row.key === 'delivery.partnerEarnings')?.value;
  if (saved && typeof saved === 'object') {
    const row = saved as Record<string, unknown>;
    return {
      baseKm: String(numberValue(row.baseKm, 3)),
      baseCharge: String(numberValue(row.baseCharge, 0)),
      perKmCharge: String(numberValue(row.perKmCharge, 0)),
    };
  }
  return EMPTY;
}

function money(amount: number): string {
  return `₹${amount}`;
}

export function PartnerEarningsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const config = useQuery({
    queryKey: ['configuration'],
    queryFn: () => apiRequest<ConfigItem[]>('/configuration'),
  });

  useEffect(() => {
    if (config.data) setForm(formFromConfig(config.data));
  }, [config.data]);

  const preview = useMemo(() => {
    const baseKm = Number(form.baseKm);
    const base = Number(form.baseCharge);
    const perKm = Number(form.perKmCharge);
    if (![baseKm, base, perKm].every((n) => Number.isFinite(n) && n >= 0)) return null;
    const sampleKm = baseKm + 2;
    return {
      baseKm,
      base,
      perKm,
      sampleKm,
      sample: base + Math.ceil(sampleKm - baseKm) * perKm,
    };
  }, [form.baseKm, form.baseCharge, form.perKmCharge]);

  const save = useMutation({
    mutationFn: (value: FormState) =>
      apiRequest<null>('/configuration/delivery.partnerEarnings', {
        method: 'PATCH',
        body: JSON.stringify({
          value: {
            baseKm: Number(value.baseKm),
            baseCharge: Number(value.baseCharge),
            perKmCharge: Number(value.perKmCharge),
          },
        }),
      }),
    onSuccess: async () => {
      setError(null);
      setSaved(true);
      await qc.invalidateQueries({ queryKey: ['configuration'] });
    },
    onError: (err) => {
      setSaved(false);
      setError(err instanceof Error ? err.message : 'Could not save partner earnings');
    },
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaved(false);
    const baseKm = Number(form.baseKm);
    const baseCharge = Number(form.baseCharge);
    const perKmCharge = Number(form.perKmCharge);
    if (![baseKm, baseCharge, perKmCharge].every((n) => Number.isFinite(n) && n >= 0)) {
      setError('Enter zero or a positive number for each field.');
      return;
    }
    save.mutate(form);
  }

  if (config.isLoading) return <p>Loading partner earnings…</p>;
  if (config.error) return <p className="error">{(config.error as Error).message}</p>;

  return (
    <div>
      <h1>Partner earnings</h1>
      <p style={{ maxWidth: 720, marginBottom: 16 }}>
        What a delivery partner earns for a trip. Distance is only from the restaurant to the customer. This is
        separate from the delivery charge the customer pays.
      </p>
      <form onSubmit={submit} style={{ maxWidth: 520, display: 'grid', gap: 16 }}>
        <label>
          Base distance (km)
          <input
            type="number"
            min={0}
            step="0.1"
            value={form.baseKm}
            onChange={(e) => setForm({ ...form, baseKm: e.target.value })}
          />
          <small>The base earning covers 0 km up to this distance. Example: 3.</small>
        </label>
        <label>
          Base earning (₹)
          <input
            type="number"
            min={0}
            step="1"
            value={form.baseCharge}
            onChange={(e) => setForm({ ...form, baseCharge: e.target.value })}
          />
          <small>Paid once when the restaurant-to-customer trip is within the base distance.</small>
        </label>
        <label>
          Additional charge per km (₹)
          <input
            type="number"
            min={0}
            step="1"
            value={form.perKmCharge}
            onChange={(e) => setForm({ ...form, perKmCharge: e.target.value })}
          />
          <small>Added for every kilometre after the base distance.</small>
        </label>
        {preview ? (
          <p style={{ margin: 0 }}>
            Example: 0–{preview.baseKm} km earns {money(preview.base)}. A {preview.sampleKm} km trip earns{' '}
            {money(preview.sample)} ({money(preview.base)} + {preview.sampleKm - preview.baseKm} ×{' '}
            {money(preview.perKm)}).
          </p>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
        {saved ? <p>Saved.</p> : null}
        <button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save partner earnings'}
        </button>
      </form>
    </div>
  );
}
