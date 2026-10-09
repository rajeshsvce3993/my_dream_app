import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ChevronRight, Package } from 'lucide-react';
import { apiRequest } from '../api/client';
import { useBrand } from '../hooks/useBrand';
import { useLocale } from '../context/LocaleContext';
import { formatMoney, orderSerial } from '../lib/format';
import { orderStatusLabel } from '../lib/orderLabels';
import { EmptyState } from '../design-system/EmptyState';
import { HomeFeedSkeleton } from '../design-system/Skeleton';

type Order = {
  _id: string;
  orderNumber: string;
  status: string;
  grandTotal: number;
  createdAt: string;
  restaurantName?: string;
  restaurantNames?: string[];
};

function restaurantLabel(order: Order) {
  if (order.restaurantNames && order.restaurantNames.length > 0) {
    return order.restaurantNames.join(', ');
  }
  return order.restaurantName || 'Restaurant';
}

export function OrdersPage() {
  const { currency } = useBrand();
  const { locale } = useLocale();
  const orders = useQuery({
    queryKey: ['my-orders'],
    queryFn: () => apiRequest<Order[]>('/orders/my'),
    retry: false,
    refetchInterval: 8000,
  });

  if (orders.isError) {
    return (
      <EmptyState
        icon={Package}
        title="Sign in to view orders"
        description="Your order history appears here after checkout."
        actionLabel="Sign in"
        actionTo="/login?returnTo=/orders"
      />
    );
  }
  if (orders.isLoading) return <HomeFeedSkeleton />;

  const list = orders.data ?? [];

  return (
    <div>
      <h1 className="qc-greeting" style={{ fontSize: '1.5rem' }}>
        Your orders
      </h1>
      {!list.length ? (
        <EmptyState
          icon={Package}
          title="Your first order is waiting"
          description="Compare nearby vendors and checkout in minutes."
          actionLabel="Start shopping"
          actionTo="/"
        />
      ) : null}
      <div className="qc-order-list">
        {list.map((order) => (
          <Link key={order._id} to={`/orders/${order._id}`} className="qc-order-card">
            <div>
              <strong>{restaurantLabel(order)}</strong>
              <p className="fm-muted-text">{orderStatusLabel(order.status, locale)}</p>
              <time className="qc-caption" dateTime={order.createdAt}>
                {orderSerial(order.orderNumber)} ·{' '}
                {new Date(order.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </time>
            </div>
            <div className="qc-order-card__right">
              <span className="qc-price">{formatMoney(currency, order.grandTotal)}</span>
              <ChevronRight size={18} aria-hidden />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
