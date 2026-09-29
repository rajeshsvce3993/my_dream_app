import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';
import { formatMoney } from '../lib/format';
import { useBrand } from '../hooks/useBrand';

export type VendorStoreProduct = {
  vendorProductId: string;
  productId: string;
  name: { en: string; ta?: string };
  brand?: string;
  imageUrl?: string;
  mrp: number;
  finalUnitPrice: number;
  discountPercent?: number;
  inStock: boolean;
  deliveryEstimateMinutes?: number;
};

export function VendorProductCard({
  product,
  vendorId,
}: {
  product: VendorStoreProduct;
  vendorId: string;
}) {
  const { tName } = useLocale();
  const { currency } = useBrand();

  return (
    <article className="qc-product-card">
      <Link
        to={`/vendors/${vendorId}/products/${product.vendorProductId}`}
        className="qc-product-card__link"
      >
        <div className="qc-product-card__media">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt="" loading="lazy" />
          ) : (
            <div className="qc-product-card__placeholder" />
          )}
          {product.discountPercent ? (
            <span className="qc-badge qc-badge--discount">-{product.discountPercent}%</span>
          ) : null}
        </div>
        <div className="qc-product-card__body">
          {product.brand ? <span className="qc-caption">{product.brand}</span> : null}
          <h3>{tName(product.name)}</h3>
          <div className="qc-price-row">
            <span className="qc-price">{formatMoney(currency, product.finalUnitPrice)}</span>
            {product.mrp > product.finalUnitPrice ? (
              <span className="qc-mrp">{formatMoney(currency, product.mrp)}</span>
            ) : null}
          </div>
          {!product.inStock ? <span className="qc-meta">Out of stock</span> : null}
          {product.deliveryEstimateMinutes ? (
            <span className="qc-delivery-badge">{product.deliveryEstimateMinutes} min</span>
          ) : null}
        </div>
      </Link>
      <Link
        to={`/vendors/${vendorId}/products/${product.vendorProductId}`}
        className="qc-add-btn"
        aria-label="View product"
      >
        <Plus size={20} />
      </Link>
    </article>
  );
}
