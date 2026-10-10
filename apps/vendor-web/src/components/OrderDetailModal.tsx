import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiRequest } from '../api/client';
import { formatWhen, money } from '../lib/format';
import { kitchenActionLabel, orderSerial, queueStatusLabel, queueStatusTone } from '../lib/orderActions';
import { Modal } from './Modal';

type Detail = {
  vendorOrder: {
    _id: string;
    orderNumber: string;
    status: string;
    subtotal: number;
    vendorPayoutAmount: number;
  };
  parentOrder: {
    orderNumber: string;
    paymentStatus: string;
    deliveryCity?: string;
    deliveryLine1?: string;
    createdAt?: string;
  } | null;
  items: Array<{
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    productName?: string;
    variantName?: string;
  }>;
  allowedNextStatuses: string[];
};

type Props = {
  id: string;
  onClose: () => void;
};

export function OrderDetailModal({ id, onClose }: Props) {
  const qc = useQueryClient();
  const [banner, setBanner] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const detail = useQuery({
    queryKey: ['vendor-order', id],
    queryFn: () => apiRequest<Detail>(`/vendor/orders/${id}`),
    enabled: Boolean(id),
    refetchInterval: 5000,
  });

  const updateStatus = useMutation({
    mutationFn: (input: { status: string; reason?: string }) =>
      apiRequest(`/vendor/orders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      setBanner(null);
      setCancelling(false);
      setCancelReason('');
      qc.invalidateQueries({ queryKey: ['vendor-order', id] });
      qc.invalidateQueries({ queryKey: ['vendor-orders'] });
      qc.invalidateQueries({ queryKey: ['vendor-me'] });
      qc.invalidateQueries({ queryKey: ['vendor-earnings'] });
    },
    onError: (err: Error) => setBanner(err.message),
  });

  const d = detail.data;
  const fullNumber = d ? d.parentOrder?.orderNumber ?? d.vendorOrder.orderNumber : '';
  const tone = d ? queueStatusTone(d.vendorOrder.status) : 'new';
  const nextKitchen = d?.allowedNextStatuses.filter((status) => status !== 'CANCELLED') ?? [];

  return (
    <Modal title={fullNumber ? `Order ${fullNumber}` : 'Order'} onClose={onClose} wide>
      {detail.isLoading && !d ? <p className="muted">Loading order…</p> : null}
      {detail.isError || (!detail.isLoading && !d) ? (
        <p className="error">{(detail.error as Error)?.message ?? 'Order not found'}</p>
      ) : null}

      {d ? (
        <div className="detail-card modal-detail">
          {banner ? <p className="error">{banner}</p> : null}

          <div className="order-card-head">
            <span className="order-serial">#{orderSerial(fullNumber)}</span>
            <span className={`order-status ${tone}`}>{queueStatusLabel(d.vendorOrder.status)}</span>
          </div>
          {d.parentOrder?.createdAt ? (
            <p className="order-meta">{formatWhen(d.parentOrder.createdAt)}</p>
          ) : null}

          <ul className="detail-lines">
            <li>
              <span>Payment</span>
              <strong>{d.parentOrder?.paymentStatus?.replaceAll('_', ' ') ?? '—'}</strong>
            </li>
            {d.parentOrder?.deliveryLine1 ? (
              <li>
                <span>Deliver to</span>
                <strong>
                  {d.parentOrder.deliveryLine1}
                  {d.parentOrder.deliveryCity ? `, ${d.parentOrder.deliveryCity}` : ''}
                </strong>
              </li>
            ) : null}
          </ul>

          <h3 className="modal-section-title">Items</h3>
          <ul className="detail-lines">
            {d.items.map((item, index) => (
              <li key={index}>
                <span>
                  {item.quantity}× {item.productName ?? 'Item'}
                  {item.variantName ? ` · ${item.variantName}` : ''}
                </span>
                <strong>{money(item.lineTotal)}</strong>
              </li>
            ))}
          </ul>

          <div className="order-money" style={{ marginTop: '1rem' }}>
            <div>
              <span>Earnings</span>
              <strong>{money(d.vendorOrder.vendorPayoutAmount)}</strong>
            </div>
            <div>
              <span>Sales</span>
              <strong>{money(d.vendorOrder.subtotal)}</strong>
            </div>
          </div>

          <div className="order-actions">
            {nextKitchen.map((status) => (
              <button
                key={status}
                type="button"
                className="vendor-btn"
                disabled={updateStatus.isPending}
                onClick={() => updateStatus.mutate({ status })}
              >
                {kitchenActionLabel(status)}
              </button>
            ))}
            {d.allowedNextStatuses.includes('CANCELLED') ? (
              <button
                type="button"
                className="vendor-btn danger"
                disabled={updateStatus.isPending}
                onClick={() => setCancelling(true)}
              >
                Cancel
              </button>
            ) : null}
          </div>

          {cancelling ? (
            <div className="cancel-box">
              <strong>Cancel reason</strong>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Why is this order cancelled?"
              />
              <div className="order-actions">
                <button type="button" className="vendor-btn secondary" onClick={() => setCancelling(false)}>
                  Back
                </button>
                <button
                  type="button"
                  className="vendor-btn danger"
                  disabled={updateStatus.isPending || cancelReason.trim().length < 2}
                  onClick={() =>
                    updateStatus.mutate({
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
      ) : null}
    </Modal>
  );
}
