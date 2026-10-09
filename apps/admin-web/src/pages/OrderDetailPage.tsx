import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useState } from 'react';
import { apiRequest } from '../api/client';

const TRACKING_STATUSES = [
  'PENDING_PAYMENT',
  'PAID',
  'CONFIRMED',
  'PROCESSING',
  'PACKED',
  'READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'REFUND_REQUESTED',
  'REFUNDED',
  'FAILED',
] as const;

type OrderStatus = (typeof TRACKING_STATUSES)[number];

type AdminOrderDetail = {
  order: {
    _id: string;
    orderNumber: string;
    status: OrderStatus;
    paymentStatus: string;
    grandTotal: number;
    subtotal: number;
    taxTotal: number;
    shippingTotal: number;
    platformFee?: number;
    discountTotal: number;
    currency: string;
    createdAt: string;
    deliveryAddress: {
      line1: string;
      line2?: string;
      city: string;
      state?: string;
      postalCode?: string;
      country: string;
    };
    timeline: Array<{ status: string; at: string; note?: string }>;
  };
  customer: {
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  } | null;
  vendorOrders: Array<{
    _id: string;
    vendorId: string;
    vendorName?: string;
    orderNumber: string;
    status: OrderStatus;
    subtotal: number;
    shippingFee: number;
    trackingNumber?: string;
    timeline: Array<{ status: string; at: string; note?: string }>;
    items: Array<{
      quantity: number;
      unitPrice: number;
      lineTotal: number;
      productName?: { en: string };
      variantName?: { en: string };
      sku?: string;
    }>;
  }>;
  allowedNextStatuses: OrderStatus[];
  tracking: { partner: string; trackingId: string };
};

function formatMoney(currency: string, amount: number) {
  const sym = currency === 'INR' ? '₹' : `${currency} `;
  return `${sym}${amount.toFixed(2)}`;
}

function statusLabel(status: string) {
  return status.replaceAll('_', ' ');
}

export function OrderDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [parentStatus, setParentStatus] = useState<OrderStatus | ''>('');
  const [parentNote, setParentNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const detail = useQuery({
    queryKey: ['admin-order', id],
    queryFn: () => apiRequest<AdminOrderDetail>(`/orders/${id}`),
    enabled: Boolean(id),
  });

  const updateParent = useMutation({
    mutationFn: (body: { status: OrderStatus; note?: string }) =>
      apiRequest(`/orders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-order', id] });
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
      setMessage('Order status updated.');
      setError(null);
      setParentStatus('');
      setParentNote('');
    },
    onError: (err: Error) => setError(err.message),
  });

  const updateVendor = useMutation({
    mutationFn: (input: {
      vendorOrderId: string;
      status: OrderStatus;
      note?: string;
      trackingNumber?: string;
    }) =>
      apiRequest(`/orders/vendor-orders/${input.vendorOrderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: input.status,
          note: input.note,
          trackingNumber: input.trackingNumber,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-order', id] });
      setMessage('Vendor order updated.');
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  if (detail.isLoading) return <p>Loading order…</p>;
  if (detail.isError || !detail.data) {
    return (
      <div>
        <Link to="/orders">← Orders</Link>
        <p className="error">Could not load order.</p>
      </div>
    );
  }

  const { order, customer, vendorOrders, allowedNextStatuses, tracking } = detail.data;
  const currency = order.currency;
  const address = [
    order.deliveryAddress.line1,
    order.deliveryAddress.line2,
    order.deliveryAddress.city,
    order.deliveryAddress.state,
    order.deliveryAddress.postalCode,
    order.deliveryAddress.country,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <Link to="/orders" style={{ fontSize: 14, color: 'var(--fm-muted)' }}>
            ← All orders
          </Link>
          <h1 style={{ margin: '0.35rem 0 0' }}>#{order.orderNumber}</h1>
          <p style={{ margin: 0, color: 'var(--fm-muted)' }}>
            Placed {new Date(order.createdAt).toLocaleString()} · {statusLabel(order.status)} ·{' '}
            {statusLabel(order.paymentStatus)}
          </p>
        </div>
        <strong style={{ fontSize: '1.25rem', color: 'var(--fm-primary)' }}>
          {formatMoney(currency, order.grandTotal)}
        </strong>
      </div>

      {message ? <p style={{ color: 'var(--fm-success)' }}>{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <div className="dashboard-charts" style={{ marginBottom: '1rem' }}>
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>Customer</h2>
          {customer ? (
            <>
              <p style={{ margin: '0.25rem 0' }}>
                <strong>
                  {[customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'Customer'}
                </strong>
              </p>
              {customer.email ? <p style={{ margin: '0.25rem 0', color: 'var(--fm-muted)' }}>{customer.email}</p> : null}
              {customer.phone ? <p style={{ margin: '0.25rem 0', color: 'var(--fm-muted)' }}>{customer.phone}</p> : null}
            </>
          ) : (
            <p style={{ color: 'var(--fm-muted)' }}>No customer profile linked.</p>
          )}
          <h3>Delivery address</h3>
          <p style={{ color: 'var(--fm-muted)', lineHeight: 1.5 }}>{address}</p>
        </div>

        <div className="panel">
          <h2 style={{ marginTop: 0 }}>Tracking (customer app)</h2>
          <p style={{ margin: '0.25rem 0' }}>
            Partner: <strong>{tracking.partner}</strong>
          </p>
          <p style={{ margin: '0.25rem 0' }}>
            Reference: <strong>{tracking.trackingId}</strong>
          </p>

          <h3>Update order status</h3>
          <p style={{ fontSize: 13, color: 'var(--fm-muted)' }}>
            Current: <strong>{statusLabel(order.status)}</strong>
            {allowedNextStatuses.length
              ? ` · Allowed next: ${allowedNextStatuses.map(statusLabel).join(', ')}`
              : ' · No further transitions'}
          </p>
          <div className="form-grid" style={{ maxWidth: '100%' }}>
            <label>
              New status
              <select
                value={parentStatus}
                onChange={(e) => setParentStatus(e.target.value as OrderStatus | '')}
              >
                <option value="">Select…</option>
                {allowedNextStatuses.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Note (optional)
              <input value={parentNote} onChange={(e) => setParentNote(e.target.value)} placeholder="Internal note" />
            </label>
            <button
              type="button"
              disabled={!parentStatus || parentStatus === order.status || updateParent.isPending}
              onClick={() => {
                if (!parentStatus) return;
                updateParent.mutate({ status: parentStatus, note: parentNote || undefined });
              }}
            >
              {updateParent.isPending ? 'Saving…' : 'Update order status'}
            </button>
          </div>
        </div>
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Timeline</h2>
        <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
          {[...order.timeline].reverse().map((entry, i) => (
            <li key={`${entry.at}-${i}`} style={{ marginBottom: 6 }}>
              <strong>{statusLabel(entry.status)}</strong>
              <span style={{ color: 'var(--fm-muted)', marginLeft: 8 }}>
                {new Date(entry.at).toLocaleString()}
              </span>
              {entry.note ? <span style={{ marginLeft: 8 }}>— {entry.note}</span> : null}
            </li>
          ))}
        </ul>
      </div>

      <h2>By vendor ({vendorOrders.length})</h2>
      <p style={{ color: 'var(--fm-muted)', maxWidth: 720 }}>
        Manage fulfillment per store. Vendor status updates sync to that store&apos;s slice; updating the
        parent order status above updates customer tracking when transitions are valid.
      </p>

      {vendorOrders.map((vo) => (
        <VendorOrderPanel
          key={`${vo._id}-${vo.status}-${vo.trackingNumber ?? ''}`}
          vendorOrder={vo}
          currency={currency}
          pending={updateVendor.isPending}
          onSave={(payload) => updateVendor.mutate({ vendorOrderId: vo._id, ...payload })}
        />
      ))}

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Bill summary</h2>
        <table>
          <tbody>
            <tr>
              <td>Item total</td>
              <td>{formatMoney(currency, Math.max(0, order.subtotal - order.taxTotal))}</td>
            </tr>
            <tr>
              <td>Discount</td>
              <td>{formatMoney(currency, order.discountTotal)}</td>
            </tr>
            <tr>
              <td>Delivery charges</td>
              <td>{formatMoney(currency, order.shippingTotal + (order.platformFee ?? 0))}</td>
            </tr>
            <tr>
              <td>GST</td>
              <td>{formatMoney(currency, order.taxTotal)}</td>
            </tr>
            <tr>
              <td>
                <strong>Grand total</strong>
              </td>
              <td>
                <strong>{formatMoney(currency, order.grandTotal)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VendorOrderPanel({
  vendorOrder,
  currency,
  pending,
  onSave,
}: {
  vendorOrder: AdminOrderDetail['vendorOrders'][number];
  currency: string;
  pending: boolean;
  onSave: (payload: { status: OrderStatus; note?: string; trackingNumber?: string }) => void;
}) {
  const [status, setStatus] = useState<OrderStatus>(vendorOrder.status);
  const [note, setNote] = useState('');
  const [trackingNumber, setTrackingNumber] = useState(vendorOrder.trackingNumber ?? '');

  return (
    <div className="panel" style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div>
          <h3 style={{ margin: '0 0 0.25rem' }}>{vendorOrder.vendorName ?? 'Store'}</h3>
          <p style={{ margin: 0, color: 'var(--fm-muted)', fontSize: 14 }}>
            {vendorOrder.orderNumber} · {statusLabel(vendorOrder.status)}
          </p>
        </div>
        <strong>{formatMoney(currency, vendorOrder.subtotal + vendorOrder.shippingFee)}</strong>
      </div>

      <table style={{ marginTop: '1rem' }}>
        <thead>
          <tr>
            <th>Product</th>
            <th>SKU</th>
            <th>Qty</th>
            <th>Unit</th>
            <th>Line total</th>
          </tr>
        </thead>
        <tbody>
          {vendorOrder.items.map((line, idx) => (
            <tr key={idx}>
              <td>
                {line.productName?.en ?? 'Product'}
                {line.variantName?.en ? (
                  <span style={{ color: 'var(--fm-muted)', fontSize: 12 }}> · {line.variantName.en}</span>
                ) : null}
              </td>
              <td>{line.sku ?? '—'}</td>
              <td>{line.quantity}</td>
              <td>{formatMoney(currency, line.unitPrice)}</td>
              <td>{formatMoney(currency, line.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="form-grid" style={{ maxWidth: '100%', marginTop: '1rem' }}>
        <label>
          Vendor status
          <select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
            {TRACKING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tracking / AWB
          <input
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="Optional carrier tracking id"
          />
        </label>
        <label>
          Note
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            onSave({
              status,
              note: note || undefined,
              trackingNumber: trackingNumber || undefined,
            })
          }
        >
          {pending ? 'Saving…' : 'Save vendor order'}
        </button>
      </div>

      {vendorOrder.timeline.length ? (
        <details style={{ marginTop: '0.75rem' }}>
          <summary style={{ cursor: 'pointer', color: 'var(--fm-muted)' }}>Vendor timeline</summary>
          <ul style={{ paddingLeft: '1.25rem' }}>
            {[...vendorOrder.timeline].reverse().map((t, i) => (
              <li key={i}>
                {statusLabel(t.status)} — {new Date(t.at).toLocaleString()}
                {t.note ? ` (${t.note})` : ''}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
