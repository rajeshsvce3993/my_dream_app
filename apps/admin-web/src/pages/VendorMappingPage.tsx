import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiRequest } from '../api/client';

type Product = { _id: string; name: { en: string }; sku: string };
type Vendor = { _id: string; name: string; code: string };

export function VendorMappingPage() {
  const qc = useQueryClient();
  const [vendorId, setVendorId] = useState('');
  const [productId, setProductId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [vendorPrice, setVendorPrice] = useState('100');
  const [mrp, setMrp] = useState('120');
  const [sellingPrice, setSellingPrice] = useState('110');

  const vendors = useQuery({
    queryKey: ['vendors-map'],
    queryFn: () => apiRequest<Vendor[]>('/vendors?limit=100'),
  });

  const products = useQuery({
    queryKey: ['products-map'],
    queryFn: () => apiRequest<Product[]>('/products?limit=100'),
  });

  const productDetail = useQuery({
    queryKey: ['product-variants', productId],
    queryFn: () =>
      apiRequest<{ variants: Array<{ _id: string; sku: string; name: { en: string } }> }>(
        `/products/${productId}`,
      ),
    enabled: Boolean(productId),
  });

  const createMapping = useMutation({
    mutationFn: () =>
      apiRequest('/vendor-products', {
        method: 'POST',
        body: JSON.stringify({
          vendorId,
          productId,
          variantId,
          vendorPrice: Number(vendorPrice),
          mrp: Number(mrp),
          sellingPrice: Number(sellingPrice),
        }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products-map'] }),
  });

  return (
    <div>
      <h1>Vendor–product mapping</h1>
      <p style={{ color: 'var(--fm-muted)' }}>Map catalog products to vendors with vendor-specific pricing and stock.</p>
      <div className="panel form-grid">
        <label>
          Vendor
          <select value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
            <option value="">Select vendor</option>
            {(vendors.data ?? []).map((v) => (
              <option key={v._id} value={v._id}>
                {v.name} ({v.code})
              </option>
            ))}
          </select>
        </label>
        <label>
          Product
          <select
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              setVariantId('');
            }}
          >
            <option value="">Select product</option>
            {(products.data ?? []).map((p) => (
              <option key={p._id} value={p._id}>
                {p.name.en} ({p.sku})
              </option>
            ))}
          </select>
        </label>
        <label>
          Variant
          <select value={variantId} onChange={(e) => setVariantId(e.target.value)}>
            <option value="">Select variant</option>
            {(productDetail.data?.variants ?? []).map((v) => (
              <option key={v._id} value={v._id}>
                {v.name.en} ({v.sku})
              </option>
            ))}
          </select>
        </label>
        <label>
          Vendor price
          <input value={vendorPrice} onChange={(e) => setVendorPrice(e.target.value)} />
        </label>
        <label>
          MRP
          <input value={mrp} onChange={(e) => setMrp(e.target.value)} />
        </label>
        <label>
          Selling price
          <input value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} />
        </label>
        <button
          className="btn"
          disabled={!vendorId || !productId || !variantId || createMapping.isPending}
          onClick={() => createMapping.mutate()}
        >
          Save mapping
        </button>
      </div>
    </div>
  );
}
