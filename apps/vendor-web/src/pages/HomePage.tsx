import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { OrderDetailModal } from '../components/OrderDetailModal';
import { apiRequest } from '../api/client';
import { formatWhen, money } from '../lib/format';
import { kitchenActionLabel, orderSerial, queueStatusLabel, queueStatusTone } from '../lib/orderActions';

type QueueOrder = {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  vendorPayoutAmount: number;
  itemCount: number;
  items: Array<{ quantity: number; name: string; lineTotal?: number }>;
  createdAt: string;
  allowedNextStatuses: string[];
};

type Me = {
  approvalStatus: string;
  acceptingOrders: boolean;
  vendor: { id: string; name: string; code: string; status: string } | null;
  stats: {
    newOrders: number;
    activeOrders: number;
    todayOrderCount: number;
    todaySales: number;
    todayEarnings: number;
  };
};

const tabs = [
  { key: 'new', label: 'New' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Done' },
] as const;

export function HomePage() {
  const qc = useQueryClient();
  const [bucket, setBucket] = useState<(typeof tabs)[number]['key']>('new');
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const me = useQuery({
    queryKey: ['vendor-me'],
    queryFn: () => apiRequest<Me>('/vendor/me'),
    refetchInterval: 8000,
  });

  const queue = useQuery({
    queryKey: ['vendor-orders', bucket],
    queryFn: () => apiRequest<QueueOrder[]>(`/vendor/orders?bucket=${bucket}`),
    enabled: me.data?.approvalStatus === 'APPROVED',
    refetchInterval: 5000,
  });

  const toggleOrders = useMutation({
    mutationFn: (acceptingOrders: boolean) =>
      apiRequest('/vendor/me/accepting-orders', {
        method: 'POST',
        body: JSON.stringify({ acceptingOrders }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendor-me'] }),
  });

  const updateStatus = useMutation({
    mutationFn: (input: { id: string; status: string; reason?: string }) =>
      apiRequest(`/vendor/orders/${input.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: input.status, reason: input.reason }),
      }),
    onSuccess: () => {
      setActionError(null);
      setCancelId(null);
      setCancelReason('');
      qc.invalidateQueries({ queryKey: ['vendor-orders'] });
      qc.invalidateQueries({ queryKey: ['vendor-me'] });
      qc.invalidateQueries({ queryKey: ['vendor-earnings'] });
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const data = me.data;
  const vendorActive = data?.vendor?.status === 'ACTIVE';
  const shopOpen = Boolean(data?.acceptingOrders && vendorActive);
  const approved = data?.approvalStatus === 'APPROVED';

  if (me.isLoading && !data) return <p className="muted">Loading shop…</p>;
  if (me.isError && !data) return <p className="error">{(me.error as Error).message}</p>;

  return (
    <div>
      <div className="vendor-page-head">
        <div>
          <h1>{data?.vendor?.name ?? 'Shop'}</h1>
        </div>
        <p className={`vendor-accepting ${shopOpen ? 'is-on' : 'is-off'}`}>
          <span className="vendor-accepting-dot" aria-hidden />
          {shopOpen ? 'Accepting orders' : 'Not accepting orders'}
        </p>
      </div>

      <div className={`vendor-open-bar ${shopOpen ? 'is-open' : 'is-closed'}`}>
        <div>
          <strong>{shopOpen ? 'Shop is open' : 'Shop is closed'}</strong>
          <span>
            {approved
              ? shopOpen
                ? 'Customers can place new orders.'
                : vendorActive
                  ? 'New orders are paused.'
                  : 'This shop is inactive.'
              : 'Account is waiting for approval.'}
          </span>
        </div>
        <button
          type="button"
          className={`vendor-switch ${shopOpen ? '' : 'is-closed'}`}
          disabled={!approved || !vendorActive || toggleOrders.isPending}
          onClick={() => toggleOrders.mutate(!shopOpen)}
        >
          {shopOpen ? 'Close shop' : 'Open shop'}
        </button>
      </div>

      <div className="vendor-stats">
        <div className="vendor-stat">
          <span>Today earnings</span>
          <strong>{money(data?.stats.todayEarnings ?? 0)}</strong>
        </div>
        <div className="vendor-stat">
          <span>Today orders</span>
          <strong>{data?.stats.todayOrderCount ?? 0}</strong>
        </div>
      </div>

      <section className="vendor-panel">
        <div className="vendor-tabs">
          {tabs.map((tab) => {
            const count =
              tab.key === 'new'
                ? data?.stats.newOrders ?? 0
                : tab.key === 'active'
                  ? data?.stats.activeOrders ?? 0
                  : null;
            return (
              <button
                key={tab.key}
                type="button"
                className={bucket === tab.key ? 'is-on' : ''}
                onClick={() => setBucket(tab.key)}
              >
                <span className="vendor-tab-label">{tab.label}</span>
                {count != null ? <span className="vendor-tab-count">{count}</span> : null}
              </button>
            );
          })}
        </div>

        {actionError ? <p className="error" style={{ padding: '0.75rem 1rem 0' }}>{actionError}</p> : null}

        {!approved ? (
          <p className="empty">Your account is not approved yet.</p>
        ) : queue.isLoading ? (
          <p className="empty">Loading orders…</p>
        ) : (queue.data ?? []).length === 0 ? (
          <p className="empty">No {bucket} orders right now.</p>
        ) : (
          <div className="order-list">
            {(queue.data ?? []).map((order) => {
              const tone = queueStatusTone(order.status);
              const nextKitchen = order.allowedNextStatuses.filter((status) => status !== 'CANCELLED');
              return (
                <div className="order-card" key={order.id}>
                  <div className="order-card-head">
                    <button type="button" className="order-serial" onClick={() => setSelectedId(order.id)}>
                      #{orderSerial(order.orderNumber)}
                    </button>
                    <span className={`order-status ${tone}`}>{queueStatusLabel(order.status)}</span>
                  </div>
                  <p className="order-meta">
                    {formatWhen(order.createdAt)} · {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}
                  </p>
                  <ul className="detail-lines">
                    {order.items.slice(0, 4).map((item, index) => (
                      <li key={`${order.id}-${index}`}>
                        <span>
                          {item.quantity}× {item.name}
                        </span>
                        <span>{item.lineTotal != null ? money(item.lineTotal) : ''}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="order-money">
                    <div>
                      <span>Earnings</span>
                      <strong>{money(order.vendorPayoutAmount)}</strong>
                    </div>
                    <div>
                      <span>Sales</span>
                      <strong>{money(order.subtotal)}</strong>
                    </div>
                  </div>
                  {bucket !== 'completed' ? (
                    <div className="order-actions">
                      {nextKitchen.map((status) => (
                        <button
                          key={status}
                          type="button"
                          className="vendor-btn"
                          disabled={updateStatus.isPending}
                          onClick={() => updateStatus.mutate({ id: order.id, status })}
                        >
                          {kitchenActionLabel(status)}
                        </button>
                      ))}
                      {order.allowedNextStatuses.includes('CANCELLED') ? (
                        <button
                          type="button"
                          className="vendor-btn danger"
                          disabled={updateStatus.isPending}
                          onClick={() => {
                            setCancelId(order.id);
                            setCancelReason('');
                          }}
                        >
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {cancelId === order.id ? (
                    <div className="cancel-box">
                      <strong>Cancel reason</strong>
                      <textarea
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="Why is this order cancelled?"
                      />
                      <div className="order-actions">
                        <button type="button" className="vendor-btn secondary" onClick={() => setCancelId(null)}>
                          Back
                        </button>
                        <button
                          type="button"
                          className="vendor-btn danger"
                          disabled={updateStatus.isPending || cancelReason.trim().length < 2}
                          onClick={() =>
                            updateStatus.mutate({
                              id: order.id,
                              status: 'CANCELLED',
                              reason: cancelReason.trim(),
                            })
                          }
                        >
                          Confirm cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {selectedId ? <OrderDetailModal id={selectedId} onClose={() => setSelectedId(null)} /> : null}
    </div>
  );
}
