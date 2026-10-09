import { Link } from 'react-router-dom';
import { useBrand } from '../hooks/useBrand';
import { useLocale } from '../context/LocaleContext';
import type { CartCalc } from '../hooks/useCart';
import { formatMoney } from '../lib/format';

type Props = {
  cart: CartCalc;
  actionLabel?: string;
  actionTo?: string;
  onAction?: () => void;
};

export function OrderSummary({ cart, actionLabel, actionTo, onAction }: Props) {
  const { currency } = useBrand();
  const { tName } = useLocale();

  return (
    <aside className="fm-summary">
      <h3 style={{ marginTop: 0 }}>Order summary</h3>
      <ul className="fm-summary-lines">
        {(cart.lines ?? []).map((line) => (
          <li key={`${line.vendorId}-${line.variantId}`}>
            {line.imageUrl ? (
              <img src={line.imageUrl} alt="" className="fm-summary-thumb" />
            ) : (
              <div className="fm-summary-thumb fm-summary-thumb-empty" />
            )}
            <div>
              <div className="fm-summary-name">{tName(line.productName)}</div>
              <div className="fm-muted-text">
                {formatMoney(currency, Math.max(0, line.lineTotal - (line.taxAmount ?? 0)) / line.quantity)} ×{' '}
                {line.quantity}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="fm-summary-row">
        <span>Item total</span>
        <span>
          {formatMoney(
            currency,
            cart.lines.reduce((sum, line) => sum + Math.max(0, line.lineTotal - (line.taxAmount ?? 0)), 0),
          )}
        </span>
      </div>
      {cart.discountTotal > 0 ? (
        <div className="fm-summary-row fm-discount">
          <span>Discount</span>
          <span>-{formatMoney(currency, cart.discountTotal)}</span>
        </div>
      ) : null}
      <div className="fm-summary-row">
        <span>Delivery charges</span>
        <span>{formatMoney(currency, cart.shippingTotal + (cart.platformFee ?? 0))}</span>
      </div>
      {cart.taxTotal > 0 ? (
        <div className="fm-summary-row">
          <span>GST</span>
          <span>{formatMoney(currency, cart.taxTotal)}</span>
        </div>
      ) : null}
      <div className="fm-summary-row fm-summary-total">
        <strong>TOTAL</strong>
        <strong className="fm-total-price">{formatMoney(currency, cart.grandTotal)}</strong>
      </div>
      {actionTo ? (
        <Link to={actionTo} className="fm-btn fm-btn-block fm-btn-lg">
          {actionLabel ?? 'Continue'}
        </Link>
      ) : null}
      {onAction ? (
        <button type="button" className="fm-btn fm-btn-block fm-btn-lg" onClick={onAction}>
          {actionLabel ?? 'Continue'}
        </button>
      ) : null}
    </aside>
  );
}
