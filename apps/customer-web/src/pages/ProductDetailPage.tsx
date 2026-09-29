import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { useLocale } from '../context/LocaleContext';
import { useBrand } from '../hooks/useBrand';
import { formatMoney } from '../lib/format';

type ProductDetail = {
  product: {
    _id: string;
    name: { en: string; ta?: string };
    brand?: string;
    description?: { en?: string; ta?: string };
    images?: { url: string }[];
    categoryId?: string;
  };
  variants: Array<{ _id: string; name: { en: string; ta?: string } }>;
};

type Comparison = {
  vendors: Array<{
    vendorId: string;
    vendorName: string;
    finalUnitPrice: number;
    distanceKm?: number;
    availableQuantity: number;
    rating: number;
    mrp: number;
    sellingPrice: number;
    deliveryEstimateMinutes?: number;
  }>;
  cheapestVendorId: string | null;
  nearestVendorId: string | null;
  bestOverallVendorId: string | null;
};

export function ProductDetailPage() {
  const { id } = useParams();
  const { tName } = useLocale();
  const { currency } = useBrand();
  const qc = useQueryClient();
  const [variantId, setVariantId] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState<'description' | 'specs' | 'reviews'>('description');

  const detail = useQuery({
    queryKey: ['product', id],
    queryFn: () => apiRequest<ProductDetail>(`/products/${id}`),
    enabled: Boolean(id),
  });

  const activeVariantId = variantId || detail.data?.variants[0]?._id || '';

  const comparison = useQuery({
    queryKey: ['comparison', id, activeVariantId],
    queryFn: () =>
      apiRequest<Comparison>(
        `/products/${id}/vendor-comparison?variantId=${activeVariantId}&lng=80.2707&lat=13.0827`,
      ),
    enabled: Boolean(id && activeVariantId),
  });

  const addToCart = useMutation({
    mutationFn: () =>
      apiRequest('/cart/items', {
        method: 'POST',
        body: JSON.stringify({
          vendorId: selectedVendorId || comparison.data?.bestOverallVendorId,
          productId: id,
          variantId: activeVariantId,
          quantity: qty,
          lng: 80.2707,
          lat: 13.0827,
        }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cart'] }),
  });

  if (!detail.data) return <p>Loading product…</p>;

  const product = detail.data.product;
  const bestVendor = comparison.data?.vendors.find((v) => v.vendorId === comparison.data?.bestOverallVendorId);
  const displayPrice = bestVendor?.finalUnitPrice ?? bestVendor?.sellingPrice ?? 0;
  const displayMrp = bestVendor?.mrp ?? displayPrice;

  function vendorTag(vendorId: string) {
    if (vendorId === comparison.data?.bestOverallVendorId) return { label: 'BEST OVERALL', tone: 'green' };
    if (vendorId === comparison.data?.cheapestVendorId) return { label: 'BEST PRICE', tone: 'green' };
    if (vendorId === comparison.data?.nearestVendorId) return { label: 'NEAREST', tone: 'orange' };
    return null;
  }

  return (
    <div>
      <nav className="fm-breadcrumbs">
        <Link to="/">Home</Link>
        <span>›</span>
        <Link to="/products">Groceries</Link>
        <span>›</span>
        <span>{tName(product.name)}</span>
      </nav>

      <div className="fm-layout-split fm-pdp-top">
        <div className="fm-pdp-gallery">
          {product.images?.[0]?.url ? (
            <img src={product.images[0].url} alt="" className="fm-pdp-main-img" />
          ) : (
            <div className="fm-pdp-main-img fm-img-placeholder" />
          )}
          <div className="fm-pdp-thumbs">
            {(product.images ?? []).slice(0, 4).map((img, i) =>
              img.url ? <img key={i} src={img.url} alt="" /> : null,
            )}
          </div>
        </div>
        <div>
          <h1 style={{ marginTop: 0 }}>{tName(product.name)}</h1>
          <div className="fm-rating">★★★★★ 4.7 (115 reviews)</div>
          <div className="fm-price-row">
            <span className="fm-mrp">MRP {formatMoney(currency, displayMrp)}</span>
            <span className="fm-best-price">Best Price {formatMoney(currency, displayPrice)}</span>
            {displayMrp > displayPrice ? (
              <span className="fm-save">Save {formatMoney(currency, displayMrp - displayPrice)}</span>
            ) : null}
          </div>
          <label className="fm-field">
            Size / Weight
            <select value={activeVariantId} onChange={(e) => setVariantId(e.target.value)}>
              {detail.data.variants.map((v) => (
                <option key={v._id} value={v._id}>
                  {tName(v.name)}
                </option>
              ))}
            </select>
          </label>
          <div className="fm-qty fm-qty-lg">
            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))}>
              −
            </button>
            <span>{qty}</span>
            <button type="button" onClick={() => setQty((q) => q + 1)}>
              +
            </button>
          </div>
        </div>
      </div>

      <h2 className="fm-section-title">Compare vendors</h2>
      <div className="fm-vendor-compare-row">
        {(comparison.data?.vendors ?? []).map((v) => {
          const tag = vendorTag(v.vendorId);
          return (
            <div key={v.vendorId} className="fm-vendor-offer-card">
              {tag ? <span className={`fm-vendor-tag fm-vendor-tag-${tag.tone}`}>{tag.label}</span> : null}
              <strong>{v.vendorName}</strong>
              <div className="fm-price">{formatMoney(currency, v.finalUnitPrice)}</div>
              <div className="fm-muted-text">
                {v.distanceKm?.toFixed(1) ?? '—'} km · {v.deliveryEstimateMinutes ?? 30} min
              </div>
              <div className="fm-rating">★ {v.rating.toFixed(1)}</div>
              <div className="fm-muted-text">{v.availableQuantity > 0 ? '✓ Available' : 'Out of stock'}</div>
              <button
                type="button"
                className="fm-btn fm-btn-block fm-btn-sm"
                onClick={() => setSelectedVendorId(v.vendorId)}
              >
                {selectedVendorId === v.vendorId ? 'Selected' : 'Select Vendor'}
              </button>
            </div>
          );
        })}
      </div>

      <div className="fm-tabs">
        {(['description', 'specs', 'reviews'] as const).map((key) => (
          <button
            key={key}
            type="button"
            className={tab === key ? 'active' : undefined}
            onClick={() => setTab(key)}
          >
            {key === 'description' ? 'Description' : key === 'specs' ? 'Specifications' : 'Reviews'}
          </button>
        ))}
      </div>
      <div className="fm-tab-panel">
        {tab === 'description' ? (
          <p>{product.description?.en ?? 'Premium quality product for everyday use.'}</p>
        ) : tab === 'specs' ? (
          <p>Brand: {product.brand ?? 'FreshMart Select'}</p>
        ) : (
          <p>Customer reviews will appear here.</p>
        )}
      </div>

      <div className="fm-pdp-sticky">
        <button type="button" className="fm-icon-btn" aria-label="Wishlist">
          ♡
        </button>
        <button
          className="fm-btn"
          disabled={addToCart.isPending}
          onClick={() => addToCart.mutate()}
        >
          Add to Cart
        </button>
        <button
          className="fm-btn fm-btn-outline"
          disabled={addToCart.isPending}
          onClick={() => addToCart.mutate()}
        >
          Buy Now
        </button>
      </div>
    </div>
  );
}
