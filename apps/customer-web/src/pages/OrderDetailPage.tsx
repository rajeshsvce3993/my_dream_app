import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Headphones, Map } from 'lucide-react';
import { apiRequest } from '../api/client';
import { OrderTimeline } from '../components/OrderTimeline';
import { useBrand } from '../hooks/useBrand';
import { useLocale } from '../context/LocaleContext';
import { formatMoney } from '../lib/format';
import { orderStatusLabel } from '../lib/orderLabels';
import { ErrorState } from '../design-system/ErrorState';
import { HomeFeedSkeleton } from '../design-system/Skeleton';

type OrderDetail = {
  order: {
    orderNumber: string;
    status: string;
    grandTotal: number;
    createdAt: string;
    timeline: Array<{ status: string; at: string }>;
    deliveryAddress?: { line1: string; city: string };
  };
  vendorOrders: Array<{ vendorName?: string }>;
  items: Array<{
    quantity: number;
    productName?: { en: string; ta?: string };
    imageUrl?: string;
    vendorName?: string;
  }>;
  tracking?: {
    partner: string;
    trackingId: string;
    assignedPartner?: { name?: string; phone?: string } | null;
  };
};

export function OrderDetailPage() {
  const { id } = useParams();
  const { currency } = useBrand();
  const { tName, locale } = useLocale();
  const detail = useQuery({
    queryKey: ['order-detail', id],
    queryFn: () => apiRequest<OrderDetail>(`/orders/my/${id}`),
    enabled: Boolean(id),
    retry: false,
    refetchInterval: 5000,
  });

  if (detail.isError) {
    return (
      <ErrorState
        message="We couldn't load this order."
        onRetry={() => detail.refetch()}
      />
    );
  }
  if (detail.isLoading || !detail.data) return <HomeFeedSkeleton />;

  const { order, items, tracking } = detail.data;
  const restaurantNames = [
    ...new Set(
      (detail.data.vendorOrders ?? [])
        .map((vendor) => vendor.vendorName)
        .filter((name): name is string => Boolean(name)),
    ),
  ];
  const primaryVendor =
    restaurantNames.join(', ') || items[0]?.vendorName || 'Restaurant';
  const placed = new Date(order.createdAt).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="fm-layout-split fm-order-track qc-order-track">
      <div>
        <div className="fm-order-head">
          <div>
            <h1 style={{ margin: 0 }}>{primaryVendor}</h1>
            <p className="fm-muted-text">
              Order {order.orderNumber} · Placed {placed}
            </p>
          </div>
          <span className="qc-status-pill">{orderStatusLabel(order.status, locale)}</span>
        </div>

        <section className="qc-track-panel">
          <h2 className="qc-section-header" style={{ marginBottom: '1rem' }}>
            Live tracking
          </h2>
          <OrderTimeline
            current={order.status}
            timeline={order.timeline}
            labelFor={(s) => orderStatusLabel(s, locale)}
          />
        </section>
      </div>

      <aside className="fm-order-aside">
        <div className="fm-summary qc-track-panel">
          <h3 style={{ marginTop: 0 }}>Delivery details</h3>
          <p className="fm-muted-text">Vendor: {primaryVendor}</p>
          {order.deliveryAddress ? (
            <p className="fm-muted-text">
              {order.deliveryAddress.line1}, {order.deliveryAddress.city}
            </p>
          ) : null}
          <ul className="fm-summary-lines">
            {items.map((item, idx) => (
              <li key={idx}>
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" className="fm-summary-thumb" />
                ) : (
                  <div className="fm-summary-thumb fm-summary-thumb-empty" />
                )}
                <div>
                  <div>{item.productName ? tName(item.productName) : 'Item'}</div>
                  <div className="fm-muted-text">×{item.quantity}</div>
                </div>
              </li>
            ))}
          </ul>
          <p>
            <span className="fm-muted-text">Delivery partner</span>
            <br />
            {tracking?.assignedPartner?.name ? (
              <strong>{tracking.assignedPartner.name}</strong>
            ) : (
              <span>
                {order.status === 'CANCELLED'
                  ? 'No delivery partner was assigned.'
                  : order.status === 'READY_FOR_PICKUP' || order.status === 'OUT_FOR_DELIVERY'
                    ? 'Looking for a delivery partner nearby.'
                    : "We'll assign a delivery partner once your food is prepared and a partner is available."}
              </span>
            )}
          </p>
          <button type="button" className="qc-btn qc-btn--outline qc-btn--block">
            <Map size={16} /> Track on map
          </button>
        </div>
        <div className="fm-summary qc-track-panel">
          <h3 style={{ marginTop: 0 }}>
            <Headphones size={18} /> Need help?
          </h3>
          <button type="button" className="qc-btn qc-btn--outline qc-btn--block">
            Contact support
          </button>
          <p style={{ marginTop: '1rem' }}>
            <strong>Total:</strong> {formatMoney(currency, order.grandTotal)}
          </p>
          <Link to="/orders" className="qc-meta">
            ← All orders
          </Link>
        </div>
      </aside>
    </div>
  );
}
