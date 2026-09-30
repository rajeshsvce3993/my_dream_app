import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useState } from 'react';
import { apiRequest } from '../api/client';
import { useLocationContext } from '../context/LocationContext';
import { useLocale } from '../context/LocaleContext';
import { useBrand } from '../hooks/useBrand';
import { formatMoney } from '../lib/format';
import { useAddToCartFlow } from '../components/AddToCartFlowProvider';

type VendorProductDetail = {
  vendorProductId: string;
  vendorId: string;
  productId: string;
  variantId: string;
  vendorName: string;
  name: { en: string; ta?: string };
  description?: { en?: string; ta?: string };
  brand?: string;
  imageUrl?: string;
  mrp: number;
  sellingPrice: number;
  finalUnitPrice: number;
  availableQuantity: number;
  inStock: boolean;
  deliveryEstimateMinutes?: number;
};

export function VendorProductDetailPage() {
  const { vendorId, vendorProductId } = useParams();
  const { query } = useLocationContext();
  const { tName } = useLocale();
  const { currency } = useBrand();
  const { startAddToCart, isPending } = useAddToCartFlow();
  const [qty, setQty] = useState(1);

  const detail = useQuery({
    queryKey: ['vendor-product', vendorId, vendorProductId, query.lng, query.lat],
    queryFn: () =>
      apiRequest<VendorProductDetail>(
        `/vendors/${vendorId}/products/${vendorProductId}?lng=${query.lng}&lat=${query.lat}`,
      ),
    enabled: Boolean(vendorId && vendorProductId),
  });

  if (!detail.data) return <p>Loading…</p>;
  const p = detail.data;

  return (
    <div className="qc-product-detail">
      <nav className="fm-breadcrumbs">
        <Link to="/restaurants">Restaurants</Link>
        <span>›</span>
        <Link to={`/vendors/${vendorId}`}>{p.vendorName}</Link>
        <span>›</span>
        <span>{tName(p.name)}</span>
      </nav>

      <div className="qc-pdp-grid">
        <div className="qc-pdp-media">
          {p.imageUrl ? <img src={p.imageUrl} alt="" /> : <div className="qc-product-card__placeholder" />}
        </div>
        <div>
          {p.brand ? <span className="qc-caption">{p.brand}</span> : null}
          <h1>{tName(p.name)}</h1>
          <p className="qc-sold-by">
            From <Link to={`/vendors/${vendorId}`}>{p.vendorName}</Link>
          </p>
          <div className="qc-price-row">
            <span className="qc-price qc-price--lg">{formatMoney(currency, p.finalUnitPrice)}</span>
            {p.mrp > p.finalUnitPrice ? (
              <span className="qc-mrp">MRP {formatMoney(currency, p.mrp)}</span>
            ) : null}
          </div>
          <p className={p.inStock ? 'qc-stock in-stock' : 'qc-stock out-of-stock'}>
            {p.inStock ? `In stock (${p.availableQuantity} available)` : 'Out of stock'}
          </p>
          {p.deliveryEstimateMinutes ? (
            <p className="qc-delivery-badge">Delivery in {p.deliveryEstimateMinutes} min</p>
          ) : null}
          <div className="qc-qty-row">
            <button type="button" onClick={() => setQty((n) => Math.max(1, n - 1))}>
              −
            </button>
            <span>{qty}</span>
            <button type="button" onClick={() => setQty((n) => n + 1)}>
              +
            </button>
          </div>
          <button
            type="button"
            className="btn btn--primary qc-add-cart"
            disabled={!p.inStock || isPending}
            onClick={() =>
              void startAddToCart({
                productId: p.productId,
                variantId: p.variantId,
                quantity: qty,
                productName: p.name.en,
                contextVendorId: vendorId,
                contextVendorName: p.vendorName,
                skipVendorCompare: true,
              })
            }
          >
            {isPending ? 'Adding…' : 'Add to cart'}
          </button>
          {p.description?.en ? <p>{tName(p.description as { en: string; ta?: string })}</p> : null}
        </div>
      </div>
    </div>
  );
}
