import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiRequest } from '../api/client';

type VendorOption = { _id: string; name: string; code: string };
type Row = {
  id: string;
  vendorId: string;
  vendorName?: string;
  vendorCode?: string;
  name: string;
  email?: string;
  approvalStatus: string;
  acceptingOrders: boolean;
  accountActive: boolean;
  newOrders: number;
  activeOrders: number;
};

export function VendorStaffPage() {
  const qc = useQueryClient();
  const [vendorId, setVendorId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const vendors = useQuery({
    queryKey: ['admin-vendors-short'],
    queryFn: () => apiRequest<VendorOption[]>('/vendors?limit=100'),
  });

  const list = useQuery({
    queryKey: ['vendor-staff'],
    queryFn: () => apiRequest<Row[]>('/vendor/staff'),
    refetchInterval: 15000,
  });

  const create = useMutation({
    mutationFn: () =>
      apiRequest('/vendor/staff', {
        method: 'POST',
        body: JSON.stringify({
          vendorId,
          email,
          password,
          firstName,
          lastName: lastName || undefined,
          approve: true,
        }),
      }),
    onSuccess: () => {
      setEmail('');
      setPassword('');
      setFirstName('');
      setLastName('');
      setError(null);
      qc.invalidateQueries({ queryKey: ['vendor-staff'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const patch = useMutation({
    mutationFn: (input: { id: string; body: Record<string, unknown> }) =>
      apiRequest(`/vendor/staff/${input.id}`, { method: 'PATCH', body: JSON.stringify(input.body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendor-staff'] }),
  });

  return (
    <div>
      <h1 style={{ marginBottom: 8 }}>Vendor app accounts</h1>
      <p style={{ color: '#64748B', marginBottom: 24 }}>
        Create login accounts for the Vendor mobile app. Products are still created and assigned in Admin only.
      </p>

      <section style={{ background: '#fff', padding: 20, borderRadius: 12, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>Create vendor login</h2>
        <div style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
          <select value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
            <option value="">Select vendor shop</option>
            {(vendors.data ?? []).map((v) => (
              <option key={v._id} value={v._id}>
                {v.name} ({v.code})
              </option>
            ))}
          </select>
          <input placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error ? <p style={{ color: '#DC2626' }}>{error}</p> : null}
          <button type="button" onClick={() => create.mutate()} disabled={!vendorId || create.isPending}>
            Create & approve
          </button>
        </div>
      </section>

      {list.isLoading ? <p>Loading…</p> : null}
      {list.isError ? <p>{(list.error as Error).message}</p> : null}
      <div style={{ display: 'grid', gap: 12 }}>
        {(list.data ?? []).map((row) => (
          <div key={row.id} style={{ background: '#fff', padding: 16, borderRadius: 12 }}>
            <strong>{row.name}</strong>
            <div style={{ color: '#64748B', fontSize: 14 }}>
              {row.vendorName} · {row.email}
            </div>
            <div style={{ marginTop: 8, fontSize: 14 }}>
              {row.approvalStatus} · {row.acceptingOrders ? 'Accepting orders' : 'Not accepting'} · New: {row.newOrders}{' '}
              · Active: {row.activeOrders}
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {row.approvalStatus !== 'APPROVED' ? (
                <button type="button" onClick={() => patch.mutate({ id: row.id, body: { approvalStatus: 'APPROVED' } })}>
                  Approve
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => patch.mutate({ id: row.id, body: { acceptingOrders: !row.acceptingOrders } })}
              >
                {row.acceptingOrders ? 'Pause orders' : 'Resume orders'}
              </button>
              <button
                type="button"
                onClick={() => patch.mutate({ id: row.id, body: { isActive: !row.accountActive } })}
              >
                {row.accountActive ? 'Disable login' : 'Enable login'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
