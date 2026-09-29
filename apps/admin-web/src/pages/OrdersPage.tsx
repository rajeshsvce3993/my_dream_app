import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { apiRequestWithMeta } from '../api/client';

type Order = {
  _id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  grandTotal: number;
  currency: string;
  createdAt: string;
};

const STATUS_FILTERS = [
  '',
  'CONFIRMED',
  'PROCESSING',
  'PACKED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'PENDING_PAYMENT',
] as const;

function formatMoney(order: Order) {
  const sym = order.currency === 'INR' ? '₹' : `${order.currency} `;
  return `${sym}${order.grandTotal.toFixed(0)}`;
}

function statusLabel(status: string) {
  return status.replaceAll('_', ' ');
}

export function OrdersPage() {
  const [status, setStatus] = useState<string>('');
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['admin-orders', status, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (status) params.set('status', status);
      return apiRequestWithMeta<Order[]>(`/orders?${params}`);
    },
  });

  const orders = query.data?.data ?? [];
  const meta = query.data?.meta as { totalPages?: number; total?: number; page?: number } | undefined;
  const totalPages = meta?.totalPages ?? 1;

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1 style={{ margin: 0 }}>Orders</h1>
          <p style={{ margin: '0.35rem 0 0', color: 'var(--fm-muted)' }}>
            View and manage customer orders, update tracking status, and fulfill by vendor.
          </p>
        </div>
        <label style={{ minWidth: 200 }}>
          <span style={{ fontSize: 12, color: 'var(--fm-muted)' }}>Filter by status</span>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s || 'all'} value={s}>
                {s ? statusLabel(s) : 'All statuses'}
              </option>
            ))}
          </select>
        </label>
      </div>

      {query.isLoading ? (
        <p>Loading…</p>
      ) : query.isError ? (
        <p className="error">Could not load orders. Sign in as an admin with order permissions.</p>
      ) : (
        <>
          <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
            <table>
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Total</th>
                  <th>Placed</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ color: 'var(--fm-muted)' }}>
                      No orders found.
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o._id}>
                      <td>
                        <strong>{o.orderNumber}</strong>
                      </td>
                      <td>{statusLabel(o.status)}</td>
                      <td>{statusLabel(o.paymentStatus)}</td>
                      <td>{formatMoney(o)}</td>
                      <td>{new Date(o.createdAt).toLocaleString()}</td>
                      <td>
                        <Link to={`/orders/${o._id}`}>Manage →</Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 ? (
            <div style={{ display: 'flex', gap: 8, marginTop: '1rem', alignItems: 'center' }}>
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </button>
              <span style={{ color: 'var(--fm-muted)' }}>
                Page {page} of {totalPages}
                {meta?.total != null ? ` (${meta.total} orders)` : ''}
              </span>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
