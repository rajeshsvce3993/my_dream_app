import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { OrderSummary } from '../components/OrderSummary';
import { useBrand } from '../hooks/useBrand';
import { useCart, type CartCalc } from '../hooks/useCart';
import { useLocale } from '../context/LocaleContext';
import { formatMoney } from '../lib/format';
import { EmptyState } from '../design-system/EmptyState';
import { ShoppingCart } from 'lucide-react';
import { HomeFeedSkeleton } from '../design-system/Skeleton';

export function CartPage() {
  const { currency } = useBrand();
  const { tName } = useLocale();
  const qc = useQueryClient();
  const cart = useCart();

  const updateQty = useMutation({
    mutationFn: (input: { variantId: string; vendorId: string; quantity: number }) =>
      apiRequest('/cart/items/' + input.variantId, {
        method: 'PATCH',
        body: JSON.stringify({ vendorId: input.vendorId, quantity: input.quantity }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cart'] }),
  });

  if (cart.isError) {
    return (
      <div className="fm-card fm-card-body">
        <p>Please sign in to view your cart.</p>
        <Link to="/login" className="fm-btn">
          Sign in
        </Link>
      </div>
    );
  }

  if (cart.isLoading || !cart.data) return <HomeFeedSkeleton />;

  function insightMessage(
    insight: NonNullable<CartCalc['insights']>[number],
  ): string | null {
    if (insight.type === 'FREE_DELIVERY_GAP') {
      return `Add ${insight.currency}${Math.ceil(insight.amountRemaining)} more for free delivery`;
    }
    if (insight.type === 'SAVINGS') {
      return `You're saving ${insight.currency}${Math.ceil(insight.amount)} on this order`;
    }
    return null;
  }

  const groups = cart.data.vendorGroups?.length
    ? cart.data.vendorGroups
    : [];

  return (
    <div>
      <h1 className="qc-greeting" style={{ fontSize: '1.5rem' }}>
        Your cart
      </h1>
      {(cart.data.insights ?? []).map((insight, i) => {
        const msg = insightMessage(insight);
        return msg ? (
          <div key={i} className="qc-insight">
            {msg}
          </div>
        ) : null;
      })}
      {cart.data.vendorCount > 1 ? (
        <div className="qc-insight" style={{ background: 'var(--color-success-soft)', color: 'var(--color-success)' }}>
          Ordering from {cart.data.vendorCount} vendors — separate deliveries may apply.
        </div>
      ) : null}

      <div className="fm-layout-split fm-checkout-layout">
        <div>
          {!cart.data.lines.length ? (
            <EmptyState
              icon={ShoppingCart}
              title="No groceries here yet"
              description="Browse nearby stores and add items to your cart."
              actionLabel="Start shopping"
              actionTo="/"
            />
          ) : null}
          {groups.map((group) => (
            <div key={group.vendorId} className="fm-vendor-cart-card">
              <div className="fm-vendor-cart-head">
                <div>
                  <strong>{group.vendorName}</strong>
                  <span className="fm-muted-text"> ({group.itemCount} items)</span>
                </div>
                <div>
                  Subtotal <strong>{formatMoney(currency, group.subtotal)}</strong>
                </div>
              </div>
              {group.lines.map((line) => (
                <div key={`${line.vendorId}-${line.variantId}`} className="fm-cart-line">
                  {line.imageUrl ? (
                    <img src={line.imageUrl} alt="" className="fm-cart-thumb" />
                  ) : (
                    <div className="fm-cart-thumb fm-summary-thumb-empty" />
                  )}
                  <div className="fm-cart-line-info">
                    <strong>{tName(line.productName)}</strong>
                    <div className="fm-muted-text">{formatMoney(currency, line.unitPrice)}</div>
                  </div>
                  <div className="fm-qty">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      onClick={() =>
                        updateQty.mutate({
                          variantId: line.variantId,
                          vendorId: line.vendorId,
                          quantity: Math.max(0, line.quantity - 1),
                        })
                      }
                    >
                      −
                    </button>
                    <span>{line.quantity}</span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      onClick={() =>
                        updateQty.mutate({
                          variantId: line.variantId,
                          vendorId: line.vendorId,
                          quantity: line.quantity + 1,
                        })
                      }
                    >
                      +
                    </button>
                  </div>
                  <strong>{formatMoney(currency, line.lineTotal)}</strong>
                  <button
                    type="button"
                    className="fm-trash"
                    aria-label="Remove item"
                    onClick={() =>
                      updateQty.mutate({
                        variantId: line.variantId,
                        vendorId: line.vendorId,
                        quantity: 0,
                      })
                    }
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
        {cart.data.lines.length ? (
          <OrderSummary cart={cart.data} actionLabel="Proceed to Checkout" actionTo="/checkout" />
        ) : null}
      </div>
    </div>
  );
}
