import { useQuery } from '@tanstack/react-query';
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
  recentOrders: Array<{ orderNumber: string; grandTotal: number; status: string }>;
};

const growth = [
  ['Total Revenue', 'revenue', '+12%'],
  ['Orders', 'orders', '+8%'],
  ['Customers', 'customers', '+15%'],
  ['Vendors', 'vendors', '+2%'],
] as const;

export function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiRequest<Dashboard>('/reports/dashboard'),
  });

  if (isLoading) return <p>Loading dashboard…</p>;
  if (error) return <p className="error">{(error as Error).message}</p>;

  return (
    <div>
      <div className="admin-page-head">
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <span className="admin-date-range">1 Apr 2025 – 12 Apr 2025</span>
      </div>

      <div className="metric-grid metric-grid-4">
        {growth.map(([label, key, delta]) => (
          <div key={key} className="metric-card">
            <div style={{ color: 'var(--fm-muted)' }}>{label}</div>
            <strong>
              {key === 'revenue'
                ? `₹${(data?.revenue ?? 0).toLocaleString('en-IN')}`
                : (data?.[key] ?? 0).toLocaleString('en-IN')}
            </strong>
            <span className="metric-delta">{delta}</span>
          </div>
        ))}
      </div>

      <div className="dashboard-charts">
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Sales overview</h3>
          <div className="chart-line">
            {[40, 65, 52, 78, 60, 88, 72, 95, 70, 82, 76, 90].map((h, i) => (
              <span key={i} style={{ height: `${h}%` }} title={`Apr ${i + 1}`} />
            ))}
          </div>
          <div className="chart-legend">
            <span>This period</span>
            <span className="muted">Last period</span>
          </div>
        </div>
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Order overview</h3>
          <div className="chart-bars grouped">
            {[40, 65, 52, 78, 60, 88, 72].map((h, i) => (
              <div key={i} className="bar-group">
                <span style={{ height: `${h}%` }} />
                <span style={{ height: `${Math.max(20, h - 15)}%` }} className="muted-bar" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="dashboard-widgets">
        <div className="panel panel-wide">
          <h3 style={{ marginTop: 0 }}>Recent orders</h3>
          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recentOrders ?? []).map((o) => (
                <tr key={o.orderNumber}>
                  <td>#{o.orderNumber}</td>
                  <td>₹{o.grandTotal}</td>
                  <td>
                    <span className={`status-pill status-${o.status.toLowerCase()}`}>{o.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Quick summary</h3>
          <p>
            Pending orders: <strong className="warn">{data?.pendingOrders ?? 0}</strong>
          </p>
          <p>
            Low stock SKUs: <strong>{data?.lowStock ?? 0}</strong>
          </p>
          <p>
            Products live: <strong>{data?.products ?? 0}</strong>
          </p>
        </div>
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Top products</h3>
          <ul className="simple-list">
            {['Rice 5 KG', 'Sunflower Oil 1L', 'Milk 1L', 'Tomatoes 1 KG', 'Onions 1 KG'].map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
