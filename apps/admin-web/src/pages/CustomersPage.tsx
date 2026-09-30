import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api/client';

type CustomerRow = {
  id: string;
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
  isActive: boolean;
  phoneVerified: boolean;
  hasSavedAddress: boolean;
  createdAt: string;
  lastLoginAt?: string;
};

function formatWhen(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function CustomersPage() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ['admin-customers'],
    queryFn: () => apiRequest<CustomerRow[]>('/customers'),
  });

  const patch = useMutation({
    mutationFn: (input: { id: string; isActive: boolean }) =>
      apiRequest(`/customers/${input.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: input.isActive }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-customers'] }),
  });

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1>Customers</h1>
          <p className="page-lead">
            Accounts that order through the customer app. Disable access without deleting history.
          </p>
        </div>
        <button type="button" className="secondary" onClick={() => list.refetch()}>
          Refresh
        </button>
      </div>

      {list.isLoading ? <p className="muted">Loading customers…</p> : null}
      {list.isError ? <p className="error">{(list.error as Error).message}</p> : null}

      <div className="panel">
        {(list.data ?? []).length === 0 && list.isSuccess ? (
          <div className="empty-state">No customer accounts yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Address</th>
                <th>Status</th>
                <th>Joined</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(list.data ?? []).map((c) => {
                const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Customer';
                return (
                  <tr key={c.id}>
                    <td>
                      <strong>{name}</strong>
                    </td>
                    <td>
                      <div>{c.phone || '—'}</div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {c.email}
                      </div>
                    </td>
                    <td>
                      <span className={`status-pill ${c.hasSavedAddress ? 'success' : 'warn'}`}>
                        {c.hasSavedAddress ? 'Saved' : 'Missing'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill ${c.isActive ? 'success' : 'danger'}`}>
                        {c.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td>{formatWhen(c.createdAt)}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className={c.isActive ? 'danger' : 'accent'}
                          disabled={patch.isPending}
                          onClick={() => patch.mutate({ id: c.id, isActive: !c.isActive })}
                        >
                          {c.isActive ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
