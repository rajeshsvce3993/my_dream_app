import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../api/client';

type ConfigItem = { key: string; value: unknown };

type FormState = {
  baseKm: string;
  baseDeliveryCharge: string;
  perKmCharge: string;
  platformFee: string;
};

const EMPTY: FormState = {
  baseKm: '3',
  baseDeliveryCharge: '0',
  perKmCharge: '0',
  platformFee: '0',
};

function numberValue(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formFromConfig(rows: ConfigItem[]): FormState {
  const saved = rows.find((row) => row.key === 'food.charges')?.value;
  if (saved && typeof saved === 'object') {
    const row = saved as Record<string, unknown>;
    return {
      baseKm: String(numberValue(row.baseKm, 3)),
      baseDeliveryCharge: String(numberValue(row.baseDeliveryCharge ?? row.deliveryCharge, 0)),
      perKmCharge: String(numberValue(row.perKmCharge, 0)),
      platformFee: String(numberValue(row.platformFee, 0)),
    };
  }
  return EMPTY;
}

function money(amount: number): string {
  return `₹${amount}`;
}

export function FoodChargesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'food'>('food');
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
    const base = Number(form.baseDeliveryCharge);
    const perKm = Number(form.perKmCharge);
    if (![baseKm, base, perKm].every((n) => Number.isFinite(n) && n >= 0)) return null;
    const sampleKm = baseKm + 2;
    const extra = Math.ceil(sampleKm - baseKm);
    return {
      baseKm,
      base,
      perKm,
      sampleKm,
      sample: base + extra * perKm,
    };
  }, [form.baseKm, form.baseDeliveryCharge, form.perKmCharge]);

  const save = useMutation({
    mutationFn: (value: {
      baseKm: number;
      baseDeliveryCharge: number;
      perKmCharge: number;
      platformFee: number;
    }) =>
      apiRequest<null>('/configuration/food.charges', {
        method: 'PATCH',
        body: JSON.stringify({ value }),
      }),
    onSuccess: () => {
      setError(null);
      setSaved(true);
      qc.invalidateQueries({ queryKey: ['configuration'] });
    },
    onError: (err: Error) => {
      setSaved(false);
      setError(err.message);
    },
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const baseKm = Number(form.baseKm);
    const baseDeliveryCharge = Number(form.baseDeliveryCharge);
    const perKmCharge = Number(form.perKmCharge);
    const platformFee = Number(form.platformFee);
    if (!Number.isFinite(baseKm) || baseKm < 0) {
      setError('Base distance must be zero or more kilometres.');
      return;
    }
    if (!Number.isFinite(baseDeliveryCharge) || baseDeliveryCharge < 0) {
      setError('Base delivery charge must be zero or a positive amount.');
      return;
    }
    if (!Number.isFinite(perKmCharge) || perKmCharge < 0) {
      setError('Per km charge must be zero or a positive amount.');
      return;
    }
    if (!Number.isFinite(platformFee) || platformFee < 0) {
      setError('Platform fee must be zero or a positive amount.');
      return;
    }
    setError(null);
    setSaved(false);
    save.mutate({
      baseKm,
      baseDeliveryCharge,
      perKmCharge,
      platformFee,
    });
  }

  if (config.isLoading) return <p>Loading delivery charges…</p>;
  if (config.error) return <p className="error">{(config.error as Error).message}</p>;

  return (
    <div>
      <h1>Delivery charges</h1>
      <p style={{ maxWidth: 720, marginBottom: 16 }}>
        Each type has its own tab. Food charges apply only to food orders. GST is set on each restaurant
        during onboarding.
      </p>
      <div className="panel" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button type="button" className={tab === 'food' ? 'btn' : 'btn btn--ghost'} onClick={() => setTab('food')}>
          Food
        </button>
      </div>
      {tab === 'food' ? (
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
          <small>The base delivery charge covers 0 km up to this distance. Example: 3.</small>
        </label>
        <label>
          Base delivery charge (₹)
          <input
            type="number"
            min={0}
            step="1"
            value={form.baseDeliveryCharge}
            onChange={(e) => setForm({ ...form, baseDeliveryCharge: e.target.value })}
          />
          <small>Charged once when the trip is within the base distance.</small>
        </label>
        <label>
          Per km charge (₹)
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
            Example: 0–{preview.baseKm} km is {money(preview.base)}. A {preview.sampleKm} km trip is{' '}
            {money(preview.sample)} ({money(preview.base)} + {preview.sampleKm - preview.baseKm} ×{' '}
            {money(preview.perKm)}).
          </p>
        ) : null}
        <label>
          Platform fee (₹)
          <input
            type="number"
            min={0}
            step="1"
            value={form.platformFee}
            onChange={(e) => setForm({ ...form, platformFee: e.target.value })}
          />
          <small>Included in the delivery charge the customer pays, once per food order.</small>
        </label>
        {error ? <p className="error">{error}</p> : null}
        {saved ? <p>Saved. New food checkouts use these amounts.</p> : null}
        <button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save food charges'}
        </button>
      </form>
      ) : null}
    </div>
  );
}
