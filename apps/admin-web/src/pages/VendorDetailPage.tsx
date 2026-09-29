import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';

type Vendor = {
  _id: string;
  code: string;
  name: string;
  status: string;
  rating: number;
  email?: string;
  phone?: string;
  commissionRate?: number;
  deliveryRadiusKm?: number;
  serviceAreaRadiusKm?: number;
  serviceAreaWideDelivery?: boolean;
  location?: { coordinates: [number, number] };
  address?: {
    line1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
};

type Product = { _id: string; name: { en: string }; sku: string };
type VendorProductRow = {
  _id: string;
  vendorPrice: number;
  mrp: number;
  sellingPrice: number;
  isActive: boolean;
  productId: { _id: string; name: { en: string }; sku: string };
  variantId: { _id: string; name: { en: string }; sku: string };
};

export function VendorDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'overview' | 'products'>('overview');
  const [productId, setProductId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [vendorPrice, setVendorPrice] = useState('100');
  const [mrp, setMrp] = useState('120');
  const [sellingPrice, setSellingPrice] = useState('110');
  const [stock, setStock] = useState('50');

  const [name, setName] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE' | 'SUSPENDED'>('ACTIVE');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [deliveryRadiusKm, setDeliveryRadiusKm] = useState('15');
  const [serviceAreaWideDelivery, setServiceAreaWideDelivery] = useState(false);
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const vendor = useQuery({
    queryKey: ['vendor', id],
    queryFn: () => apiRequest<Vendor>(`/vendors/${id}`),
    enabled: Boolean(id),
  });

  useEffect(() => {
    const v = vendor.data;
    if (!v) return;
    setName(v.name);
    setStatus(v.status as typeof status);
    const [lng, lat] = v.location?.coordinates ?? [];
    if (lat !== undefined) setLatitude(String(lat));
    if (lng !== undefined) setLongitude(String(lng));
    setDeliveryRadiusKm(String(v.deliveryRadiusKm ?? 15));
    setServiceAreaWideDelivery(Boolean(v.serviceAreaWideDelivery));
    setCity(v.address?.city ?? '');
    setStateName(v.address?.state ?? '');
  }, [vendor.data]);

  const saveVendor = useMutation({
    mutationFn: () => {
      const lat = Number(latitude);
      const lng = Number(longitude);
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        throw new Error('Latitude and longitude must be valid numbers');
      }
      return apiRequest(`/vendors/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          status,
          latitude: lat,
          longitude: lng,
          deliveryRadiusKm: Number(deliveryRadiusKm) || 15,
          serviceAreaRadiusKm: Number(deliveryRadiusKm) || 15,
          serviceAreaWideDelivery,
          address: {
            city: city.trim() || undefined,
            state: stateName.trim() || undefined,
            country: 'IN',
          },
        }),
      });
    },
    onSuccess: async () => {
      setSaveMessage('Vendor saved. Mobile customers nearby will see this store when in range.');
      await qc.invalidateQueries({ queryKey: ['vendor', id] });
      await qc.invalidateQueries({ queryKey: ['vendors'] });
    },
    onError: (err: Error) => setSaveMessage(err.message),
  });

  const catalog = useQuery({
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

  const vendorProducts = useQuery({
    queryKey: ['vendor-products', id],
    queryFn: () => apiRequest<VendorProductRow[]>(`/vendor-products?vendorId=${id}&limit=100`),
    enabled: Boolean(id),
  });

  const createMapping = useMutation({
    mutationFn: () =>
      apiRequest('/vendor-products', {
        method: 'POST',
        body: JSON.stringify({
          vendorId: id,
          productId,
          variantId,
          vendorPrice: Number(vendorPrice),
          mrp: Number(mrp),
          sellingPrice: Number(sellingPrice),
        }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['vendor-products', id] });
    },
  });

  const deleteVendor = useMutation({
    mutationFn: () => apiRequest(`/vendors/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['vendors'] });
      window.location.href = '/vendors';
    },
    onError: (err: Error) => setSaveMessage(err.message),
  });

  const removeMapping = useMutation({
    mutationFn: (mappingId: string) =>
      apiRequest(`/vendor-products/${mappingId}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['vendor-products', id] });
    },
  });

  if (vendor.isLoading || !vendor.data) return <p>Loading vendor…</p>;

  return (
    <div>
      <p>
        <Link to="/vendors">← Vendors</Link>
      </p>
      <h1>{vendor.data.name}</h1>
      <p style={{ color: 'var(--fm-muted)' }}>
        {vendor.data.code} · ★ {vendor.data.rating} · {vendor.data.status}
      </p>

      <div className="panel" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['overview', 'products'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={tab === t ? 'btn' : 'btn btn--ghost'}
            onClick={() => setTab(t)}
          >
            {t === 'overview' ? 'Location & details' : 'Products'}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <div className="panel form-grid">
          <h2>Store location & delivery</h2>
          <p style={{ gridColumn: '1 / -1', color: 'var(--fm-muted)', fontSize: 14 }}>
            Customers in your platform service area see this vendor when they are within the delivery radius below,
            unless <strong>Service-area delivery</strong> is enabled (no radius limit inside the zone). The store must
            have active products.
          </p>
          <label>
            Display name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
            </select>
          </label>
          <label>
            City
            <input value={city} onChange={(e) => setCity(e.target.value)} />
          </label>
          <label>
            State
            <input value={stateName} onChange={(e) => setStateName(e.target.value)} />
          </label>
          <label>
            Latitude
            <input inputMode="decimal" value={latitude} onChange={(e) => setLatitude(e.target.value)} />
          </label>
          <label>
            Longitude
            <input inputMode="decimal" value={longitude} onChange={(e) => setLongitude(e.target.value)} />
          </label>
          <label>
            Delivery radius (km)
            <input
              inputMode="numeric"
              value={deliveryRadiusKm}
              onChange={(e) => setDeliveryRadiusKm(e.target.value)}
              disabled={serviceAreaWideDelivery}
            />
          </label>
          <label style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <input
              type="checkbox"
              checked={serviceAreaWideDelivery}
              onChange={(e) => setServiceAreaWideDelivery(e.target.checked)}
            />
            <span>
              <strong>Service-area delivery (no radius limit)</strong>
              <br />
              <span style={{ color: 'var(--fm-muted)', fontSize: 13 }}>
                Show this vendor and include its prices for any customer inside the platform delivery zone, even if they
                are far from the store.
              </span>
            </span>
          </label>
          {saveMessage ? (
            <p style={{ gridColumn: '1 / -1', color: saveMessage.includes('saved') ? 'green' : 'crimson' }}>
              {saveMessage}
            </p>
          ) : null}
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn"
              disabled={!name || !latitude || !longitude || saveVendor.isPending}
              onClick={() => {
                setSaveMessage(null);
                saveVendor.mutate();
              }}
            >
              {saveVendor.isPending ? 'Saving…' : 'Save vendor'}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={deleteVendor.isPending}
              onClick={() => {
                if (
                  !window.confirm(
                    'Deactivate this vendor? It will be hidden from customers. You can set status back to ACTIVE later.',
                  )
                ) {
                  return;
                }
                setSaveMessage(null);
                deleteVendor.mutate();
              }}
            >
              {deleteVendor.isPending ? 'Deactivating…' : 'Deactivate vendor'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="panel form-grid">
            <h2>Add global product to vendor</h2>
            <label>
              Global product
              <select
                value={productId}
                onChange={(e) => {
                  setProductId(e.target.value);
                  setVariantId('');
                }}
              >
                <option value="">Search / select product</option>
                {(catalog.data ?? []).map((p) => (
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
            <label>
              Inventory
              <input value={stock} onChange={(e) => setStock(e.target.value)} />
            </label>
            <button
              className="btn"
              disabled={!productId || !variantId || createMapping.isPending}
              onClick={async () => {
                await createMapping.mutateAsync();
                if (stock) {
                  const rows = await qc.fetchQuery({
                    queryKey: ['vendor-products', id],
                    queryFn: () => apiRequest<VendorProductRow[]>(`/vendor-products?vendorId=${id}&limit=100`),
                  });
                  const row = rows.find((r) => r.variantId._id === variantId);
                  if (row) {
                    await apiRequest(`/vendor-products/${row._id}`, {
                      method: 'PATCH',
                      body: JSON.stringify({ stock: Number(stock) }),
                    });
                  }
                }
                setProductId('');
                setVariantId('');
              }}
            >
              Save mapping
            </button>
          </div>

          <h2>Vendor catalog</h2>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Variant</th>
                <th>Price</th>
                <th>MRP</th>
                <th>Active</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(vendorProducts.data ?? []).map((row) => (
                <tr key={row._id}>
                  <td>{row.productId.name.en}</td>
                  <td>{row.variantId.name.en}</td>
                  <td>₹{row.sellingPrice}</td>
                  <td>₹{row.mrp}</td>
                  <td>{row.isActive ? 'Yes' : 'No'}</td>
                  <td>
                    <button type="button" className="btn btn--ghost" onClick={() => removeMapping.mutate(row._id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
