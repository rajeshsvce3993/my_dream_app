import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
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
      setVendorId('');
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
      <div className="admin-page-head">
        <div>
          <h1>Vendor app accounts</h1>
          <p className="page-lead">
            Staff logins for the vendor app. Create per shop, approve, then they can accept and prepare orders.
          </p>
        </div>
        <button type="button" className="secondary" onClick={() => list.refetch()}>
          Refresh
        </button>
      </div>

      <div className="panel">
        <h2>Create vendor login</h2>
        <div className="form-grid">
          <label>
            Shop
            <select value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
              <option value="">Select vendor shop</option>
              {(vendors.data ?? []).map((v) => (
                <option key={v._id} value={v._id}>
                  {v.name} ({v.code})
                </option>
              ))}
            </select>
          </label>
          <div className="form-grid-2" style={{ maxWidth: '100%' }}>
            <label>
              First name
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </label>
            <label>
              Last name
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </label>
          </div>
          <label>
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button
            type="button"
            onClick={() => create.mutate()}
            disabled={!vendorId || !email || !password || !firstName || create.isPending}
          >
            {create.isPending ? 'Creating…' : 'Create & approve'}
          </button>
        </div>
      </div>

      {list.isLoading ? <p className="muted">Loading…</p> : null}
      {list.isError ? <p className="error">{(list.error as Error).message}</p> : null}

      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Staff</th>
              <th>Shop</th>
              <th>Status</th>
              <th>Queue</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(list.data ?? []).map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.name}</strong>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {row.email}
                  </div>
                </td>
                <td>
                  {row.vendorId ? (
                    <Link to={`/vendors/${row.vendorId}`}>{row.vendorName ?? row.vendorCode ?? 'Shop'}</Link>
                  ) : (
                    row.vendorName ?? '—'
                  )}
                </td>
                <td>
                  <span className={`status-pill ${row.approvalStatus === 'APPROVED' ? 'success' : 'warn'}`}>
                    {row.approvalStatus}
                  </span>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    {row.acceptingOrders ? 'Accepting orders' : 'Paused'}
                    {row.accountActive ? '' : ' · login disabled'}
                  </div>
                </td>
                <td>
                  New {row.newOrders} · Active {row.activeOrders}
                </td>
                <td>
                  <div className="row-actions">
                    {row.approvalStatus !== 'APPROVED' ? (
                      <button
                        type="button"
                        className="accent"
                        onClick={() => patch.mutate({ id: row.id, body: { approvalStatus: 'APPROVED' } })}
                      >
                        Approve
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="secondary"
                      onClick={() =>
                        patch.mutate({ id: row.id, body: { acceptingOrders: !row.acceptingOrders } })
                      }
                    >
                      {row.acceptingOrders ? 'Pause orders' : 'Resume orders'}
                    </button>
                    <button
                      type="button"
                      className={row.accountActive ? 'danger' : 'accent'}
                      onClick={() => patch.mutate({ id: row.id, body: { isActive: !row.accountActive } })}
                    >
                      {row.accountActive ? 'Disable login' : 'Enable login'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
