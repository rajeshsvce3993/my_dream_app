import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiRequest } from '../api/client';

type Row = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  accountActive: boolean;
  approvalStatus: string;
  availability: 'ONLINE' | 'OFFLINE';
  lastSeenAt?: string;
  activeOrder: { orderNumber: string; status: string } | null;
  todayDeliveries: number;
  todayEarnings: number;
};

function ago(value?: string) {
  if (!value) return 'Never';
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hours ago`;
  return new Date(value).toLocaleString();
}

export function DeliveryPeoplePage() {
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['delivery-people'],
    queryFn: () => apiRequest<Row[]>('/delivery/persons'),
    refetchInterval: 15000,
  });

  const create = useMutation({
    mutationFn: () =>
      apiRequest('/delivery/persons', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          firstName,
          lastName: lastName || undefined,
          phone: phone || undefined,
          approve: true,
        }),
      }),
    onSuccess: () => {
      setEmail('');
      setPassword('');
      setFirstName('');
      setLastName('');
      setPhone('');
      setError(null);
      qc.invalidateQueries({ queryKey: ['delivery-people'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const patch = useMutation({
    mutationFn: (input: { id: string; body: Record<string, unknown> }) =>
      apiRequest(`/delivery/persons/${input.id}`, {
        method: 'PATCH',
        body: JSON.stringify(input.body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['delivery-people'] }),
  });

  return (
    <div>
      <h1>Delivery partners</h1>
      <p style={{ color: 'var(--fm-muted)', maxWidth: 720 }}>
        Approve riders here. Online status is set by the delivery app and stored on the server. Offline riders are not offered new orders.
      </p>

      <div className="panel form-grid" style={{ marginBottom: 24 }}>
        <h2>Add delivery person</h2>
        <label>
          First name
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </label>
        <label>
          Last name
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </label>
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label>
          Phone
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button
          type="button"
          disabled={create.isPending || !email || !password || !firstName}
          onClick={() => create.mutate()}
        >
          {create.isPending ? 'Saving…' : 'Create and approve'}
        </button>
      </div>

      {list.isLoading ? <p>Loading…</p> : null}
      {list.isError ? <p className="error">Could not load delivery partners.</p> : null}

      <div className="panel" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Partner</th>
              <th>Status</th>
              <th>Active order</th>
              <th>Last seen</th>
              <th>Today</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(list.data ?? []).map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.name || row.email}</strong>
                  <div style={{ color: 'var(--fm-muted)', fontSize: 13 }}>{row.email}</div>
                </td>
                <td>
                  {row.availability === 'ONLINE' ? '● Online' : '○ Offline'}
                  <div style={{ fontSize: 12, color: 'var(--fm-muted)' }}>
                    {row.approvalStatus}
                    {row.accountActive ? '' : ' · inactive'}
                  </div>
                </td>
                <td>{row.activeOrder ? `#${row.activeOrder.orderNumber}` : 'No active delivery'}</td>
                <td>{ago(row.lastSeenAt)}</td>
                <td>
                  {row.todayDeliveries} deliveries
                  <div>₹{row.todayEarnings.toFixed(0)}</div>
                </td>
                <td>
                  {row.approvalStatus !== 'APPROVED' ? (
                    <button type="button" onClick={() => patch.mutate({ id: row.id, body: { approvalStatus: 'APPROVED' } })}>
                      Approve
                    </button>
                  ) : (
                    <button type="button" onClick={() => patch.mutate({ id: row.id, body: { approvalStatus: 'REJECTED' } })}>
                      Reject
                    </button>
                  )}
                  <button
                    type="button"
                    style={{ marginLeft: 8, background: '#334155' }}
                    onClick={() => patch.mutate({ id: row.id, body: { isActive: !row.accountActive } })}
                  >
                    {row.accountActive ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
