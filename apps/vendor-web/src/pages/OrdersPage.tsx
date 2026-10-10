import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { OrderDetailModal } from '../components/OrderDetailModal';
import { apiRequest } from '../api/client';
import { formatWhen, money } from '../lib/format';
import { orderSerial, queueStatusLabel, queueStatusTone } from '../lib/orderActions';

type Row = {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  vendorPayoutAmount: number;
  itemCount: number;
  createdAt: string;
};

type Listed = {
  items: Row[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const periods = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
] as const;

type Period = (typeof periods)[number]['key'];
const PAGE_SIZE = 20;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function periodRange(period: Period): { from?: string; to?: string } {
  const now = new Date();
  if (period === 'all') return {};
  if (period === 'today') return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
  if (period === 'week') {
    const day = now.getDay();
    const start = startOfDay(now);
    start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
    return { from: start.toISOString(), to: endOfDay(now).toISOString() };
  }
  return {
    from: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)).toISOString(),
    to: endOfDay(now).toISOString(),
  };
}

export function OrdersPage() {
  const [period, setPeriod] = useState<Period>('all');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const range = useMemo(() => periodRange(period), [period]);

  const orders = useQuery({
    queryKey: ['vendor-orders', 'history', period, page, range.from ?? '', range.to ?? ''],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (range.from) params.set('from', range.from);
      if (range.to) params.set('to', range.to);
      return apiRequest<Listed>(`/vendor/orders?${params.toString()}`);
    },
  });

  const data = orders.data;
  const from = data ? (data.page - 1) * data.limit + 1 : 0;
  const to = data ? Math.min(data.page * data.limit, data.total) : 0;

  return (
    <div>
      <div className="vendor-page-head">
        <div>
          <h1>Orders</h1>
          <p>Order history for this shop — filter by period and open any ticket.</p>
        </div>
        <div className="period-pills" role="tablist" aria-label="Order period">
          {periods.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={period === item.key}
              className={period === item.key ? 'is-on' : ''}
              onClick={() => {
                setPeriod(item.key);
                setPage(1);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <section className="vendor-panel data-panel">
        <div className="data-toolbar">
          <p className="data-toolbar-meta">
            {data ? (
              <>
                Showing <strong>{from}</strong>–<strong>{to}</strong> of <strong>{data.total}</strong> orders
              </>
            ) : (
              'Order list'
            )}
          </p>
        </div>

        {orders.isLoading ? <p className="empty">Loading orders…</p> : null}
        {orders.isError ? (
          <p className="error" style={{ padding: '1rem' }}>
            {(orders.error as Error).message}
          </p>
        ) : null}
        {data && data.items.length === 0 ? <p className="empty">No orders in this period.</p> : null}

        {data && data.items.length > 0 ? (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Placed</th>
                    <th>Status</th>
                    <th className="num">Items</th>
                    <th className="num">Sales</th>
                    <th className="num">Earnings</th>
                    <th className="actions"> </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((order) => {
                    const tone = queueStatusTone(order.status);
                    return (
                      <tr key={order.id}>
                        <td>
                          <button type="button" className="table-link" onClick={() => setSelectedId(order.id)}>
                            #{orderSerial(order.orderNumber)}
                          </button>
                        </td>
                        <td className="muted-cell">{formatWhen(order.createdAt)}</td>
                        <td>
                          <span className={`order-status ${tone}`}>{queueStatusLabel(order.status)}</span>
                        </td>
                        <td className="num">{order.itemCount}</td>
                        <td className="num">{money(order.subtotal)}</td>
                        <td className="num money-cell">{money(order.vendorPayoutAmount)}</td>
                        <td className="actions">
                          <button type="button" className="table-action" onClick={() => setSelectedId(order.id)}>
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="pager">
              <button
                type="button"
                className="vendor-btn secondary"
                disabled={page <= 1 || orders.isFetching}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Previous
              </button>
              <span className="muted">
                Page {data.page} of {data.totalPages}
              </span>
              <button
                type="button"
                className="vendor-btn secondary"
                disabled={page >= data.totalPages || orders.isFetching}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </button>
            </div>
          </>
        ) : null}
      </section>

      {selectedId ? <OrderDetailModal id={selectedId} onClose={() => setSelectedId(null)} /> : null}
    </div>
  );
}
