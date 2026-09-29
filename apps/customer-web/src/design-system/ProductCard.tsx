import { Link } from 'react-router-dom';
import { Heart, Plus } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';
import { formatMoney } from '../lib/format';
import { useBrand } from '../hooks/useBrand';

export type ProductSummary = {
  productId: string;
  name: { en: string; ta?: string };
  brand?: string;
  imageUrl?: string;
  mrp?: number;
  finalUnitPrice?: number;
  discountPercent?: number;
  vendorCount?: number;
  nearestKm?: number;
  deliveryMinutes?: number;
  rating?: number;
  labels?: string[];
};

const labelCopy: Record<string, { en: string; ta: string }> = {
  best_price: { en: 'Best price', ta: 'சிறந்த விலை' },
  nearby: { en: 'Nearby', ta: 'சுற்றுப்புறம்' },
  best_overall: { en: 'Top pick', ta: 'சிறந்த தேர்வு' },
};

export function ProductCard({
  product,
  onAdd,
  compact,
}: {
  product: ProductSummary;
  onAdd?: () => void;
  compact?: boolean;
}) {
  const { tName, locale } = useLocale();
  const { currency } = useBrand();
  const primaryLabel = product.labels?.[0];
  const badge = primaryLabel ? labelCopy[primaryLabel] : null;

  return (
    <article className={`qc-product-card ${compact ? 'qc-product-card--compact' : ''}`}>
      <Link to={`/products/${product.productId}`} className="qc-product-card__link">
        <div className="qc-product-card__media">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt="" loading="lazy" />
          ) : (
            <div className="qc-product-card__placeholder" />
          )}
          {badge ? (
            <span className="qc-badge qc-badge--brand">
              {locale === 'ta' ? badge.ta : badge.en}
            </span>
          ) : null}
          {product.discountPercent ? (
            <span className="qc-badge qc-badge--discount">-{product.discountPercent}%</span>
          ) : null}
          <button type="button" className="qc-icon-btn qc-product-card__wish" aria-label="Save to wishlist">
            <Heart size={18} />
          </button>
        </div>
        <div className="qc-product-card__body">
          {product.brand ? <span className="qc-caption">{product.brand}</span> : null}
          <h3>{tName(product.name)}</h3>
          {product.rating ? (
            <span className="qc-rating">★ {product.rating.toFixed(1)}</span>
          ) : null}
          {(product.vendorCount ?? 0) > 0 ? (
            <span className="qc-meta">
              {product.vendorCount} vendors
              {product.nearestKm != null ? ` · ${product.nearestKm.toFixed(1)} km` : ''}
            </span>
          ) : null}
          <div className="qc-price-row">
            {product.finalUnitPrice != null ? (
              <span className="qc-price">{formatMoney(currency, product.finalUnitPrice)}</span>
            ) : null}
            {product.mrp && product.finalUnitPrice && product.mrp > product.finalUnitPrice ? (
              <span className="qc-mrp">{formatMoney(currency, product.mrp)}</span>
            ) : null}
          </div>
          {product.deliveryMinutes ? (
            <span className="qc-delivery-badge">{product.deliveryMinutes} min delivery</span>
          ) : null}
        </div>
      </Link>
      {onAdd ? (
        <button type="button" className="qc-add-btn" onClick={onAdd} aria-label="Add to cart">
          <Plus size={20} />
        </button>
      ) : (
        <Link to={`/products/${product.productId}`} className="qc-add-btn" aria-label="View product">
          <Plus size={20} />
        </Link>
      )}
    </article>
  );
}
