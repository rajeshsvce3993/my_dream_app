import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api/client';

type Dashboard = {
  revenue: number;
  orders: number;
  customers: number;
  vendors: number;
  products: number;
  pendingOrders: number;
  cancelledOrders: number;
  lowStock: number;
  recentOrders: Array<{ orderNumber: string; grandTotal: number; status: string; _id?: string }>;
};

function money(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function statusClass(status: string) {
  if (status === 'DELIVERED') return 'success';
  if (status === 'CANCELLED' || status === 'FAILED') return 'danger';
  if (status === 'OUT_FOR_DELIVERY' || status === 'PROCESSING') return 'info';
  return 'warn';
}

export function DashboardPage() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiRequest<Dashboard>('/reports/dashboard'),
    refetchInterval: 30_000,
  });

  if (isLoading) return <p className="muted">Loading dashboard…</p>;
  if (error) {
    return (
      <div className="panel">
        <p className="error">{(error as Error).message}</p>
        <button type="button" onClick={() => refetch()}>
          Retry
        </button>
      </div>
    );
  }

  const metrics = [
    { label: 'Revenue', value: money(data?.revenue ?? 0), hint: 'Completed order value' },
    { label: 'Orders', value: (data?.orders ?? 0).toLocaleString('en-IN'), hint: 'All time' },
    { label: 'Customers', value: (data?.customers ?? 0).toLocaleString('en-IN'), hint: 'Registered accounts' },
    { label: 'Vendors', value: (data?.vendors ?? 0).toLocaleString('en-IN'), hint: 'Shops on platform' },
  ] as const;

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="page-lead">Live overview of customer orders, shops, and catalog health.</p>
        </div>
        <button type="button" className="secondary" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="metric-grid metric-grid-4">
        {metrics.map((m) => (
          <div key={m.label} className="metric-card">
            <div className="metric-label">{m.label}</div>
            <strong>{m.value}</strong>
            <div className="metric-hint">{m.hint}</div>
          </div>
        ))}
      </div>

      <div className="dashboard-grid">
        <div className="panel" style={{ marginTop: 0 }}>
          <div className="admin-page-head" style={{ marginBottom: '0.75rem' }}>
            <h3 style={{ margin: 0 }}>Recent orders</h3>
            <Link to="/orders">View all</Link>
          </div>
          {(data?.recentOrders ?? []).length === 0 ? (
            <div className="empty-state">No orders yet.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(data?.recentOrders ?? []).map((o) => (
                  <tr key={o.orderNumber}>
                    <td>
                      {o._id ? (
                        <Link to={`/orders/${o._id}`}>#{o.orderNumber}</Link>
                      ) : (
                        `#${o.orderNumber}`
                      )}
                    </td>
                    <td>{money(o.grandTotal)}</td>
                    <td>
                      <span className={`status-pill ${statusClass(o.status)}`}>
                        {o.status.replaceAll('_', ' ').toLowerCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ display: 'grid', gap: '1rem', alignContent: 'start' }}>
          <div className="panel" style={{ marginTop: 0 }}>
            <h3 style={{ marginTop: 0 }}>Needs attention</h3>
            <p>
              Pending / active:{' '}
              <strong className="warn">{data?.pendingOrders ?? 0}</strong>
            </p>
            <p>
              Cancelled: <strong>{data?.cancelledOrders ?? 0}</strong>
            </p>
            <p>
              Low stock mappings: <strong>{data?.lowStock ?? 0}</strong>
            </p>
            <p>
              Products live: <strong>{data?.products ?? 0}</strong>
            </p>
          </div>

          <div className="panel" style={{ marginTop: 0 }}>
            <h3 style={{ marginTop: 0 }}>Quick actions</h3>
            <div className="quick-links">
              <Link to="/orders">
                Manage orders <span>Ops</span>
              </Link>
              <Link to="/delivery-partners">
                Delivery partners <span>Riders</span>
              </Link>
              <Link to="/vendor-partners">
                Vendor accounts <span>Shops</span>
              </Link>
              <Link to="/customers">
                Customers <span>People</span>
              </Link>
              <Link to="/home-top-picks">
                Top picks <span>Home</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
