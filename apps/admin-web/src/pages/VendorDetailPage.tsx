import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';

type VendorDocuments = {
  ownerName?: string;
  ownerPhone?: string;
  ownerPan?: string;
  gstin?: string;
  gstExempt?: boolean;
  fssaiLicense?: string;
  fssaiExpiry?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  idProofType?: string;
  idProofNumber?: string;
  fssaiDocUrl?: string;
  gstDocUrl?: string;
  panDocUrl?: string;
  bankDocUrl?: string;
  idProofDocUrl?: string;
  shopPhotoUrl?: string;
};

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
  cuisineTags?: string[];
  dietType?: 'veg' | 'nonveg' | 'both';
  imageUrl?: string;
  onboardingStatus?: string;
  onboardingComplete?: boolean;
  onboardingRejectionReason?: string;
  documents?: VendorDocuments;
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

const CUISINE_OPTIONS = [
  { id: 'south-indian', label: 'South Indian' },
  { id: 'chinese', label: 'Chinese' },
  { id: 'fast-food', label: 'Fast Food' },
];

function discountPct(mrp: number, selling: number) {
  if (!mrp || mrp <= selling) return 0;
  return Math.round(((mrp - selling) / mrp) * 100);
}

export function VendorDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'overview' | 'kyc' | 'products'>('overview');
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
  const [cuisineTags, setCuisineTags] = useState<string[]>([]);
  const [dietType, setDietType] = useState<'veg' | 'nonveg' | 'both'>('both');
  const [imageUrl, setImageUrl] = useState('');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [editId, setEditId] = useState<string | null>(null);
  const [editMrp, setEditMrp] = useState('');
  const [editSelling, setEditSelling] = useState('');
  const [editVendorPrice, setEditVendorPrice] = useState('');

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
    setCuisineTags(Array.isArray(v.cuisineTags) ? [...v.cuisineTags] : []);
    setDietType(
      v.dietType === 'veg' || v.dietType === 'nonveg' || v.dietType === 'both' ? v.dietType : 'both',
    );
    setImageUrl(v.imageUrl ?? '');
  }, [vendor.data]);

  function toggleCuisine(tag: string) {
    setCuisineTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

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
          cuisineTags,
          dietType,
          imageUrl: imageUrl.trim() || undefined,
          address: {
            city: city.trim() || undefined,
            state: stateName.trim() || undefined,
            country: 'IN',
          },
        }),
      });
    },
    onSuccess: async () => {
      setSaveMessage('Restaurant saved. Mobile customers will see updated name, cuisine, and location.');
      await qc.invalidateQueries({ queryKey: ['vendor', id] });
      await qc.invalidateQueries({ queryKey: ['vendors'] });
    },
    onError: (err: Error) => setSaveMessage(err.message),
  });

  const catalog = useQuery({
    queryKey: ['products-map'],
    queryFn: () => apiRequest<Product[]>('/products?limit=200'),
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

  const updatePrice = useMutation({
    mutationFn: (input: { mappingId: string; mrp: number; sellingPrice: number; vendorPrice: number }) =>
      apiRequest(`/vendor-products/${input.mappingId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          mrp: input.mrp,
          sellingPrice: input.sellingPrice,
          vendorPrice: input.vendorPrice,
        }),
      }),
    onSuccess: async () => {
      setEditId(null);
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

  if (vendor.isLoading || !vendor.data) return <p>Loading restaurant…</p>;

  return (
    <div>
      <p>
        <Link to="/vendors">← Restaurants</Link>
      </p>
      <h1>{vendor.data.name}</h1>
      <p style={{ color: 'var(--fm-muted)' }}>
        {vendor.data.code} · ★ {vendor.data.rating} · {vendor.data.status}
        {vendor.data.onboardingStatus ? ` · KYC ${vendor.data.onboardingStatus}` : ''}
        {(vendor.data.cuisineTags ?? []).length
          ? ` · ${(vendor.data.cuisineTags ?? []).join(', ')}`
          : ''}
      </p>

      <div className="panel" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {(
          [
            ['overview', 'Details & cuisine'],
            ['kyc', 'KYC documents'],
            ['products', 'Menu & prices'],
          ] as const
        ).map(([t, label]) => (
          <button
            key={t}
            type="button"
            className={tab === t ? 'btn' : 'btn btn--ghost'}
            onClick={() => setTab(t)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'kyc' ? (
        <div className="panel form-grid">
          <h2>Shop KYC</h2>
          <p style={{ gridColumn: '1 / -1', color: 'var(--fm-muted)', fontSize: 14 }}>
            Each shop is one vendor. Documents below are required for onboarding approval.
          </p>
          <label>
            Onboarding status
            <select
              value={vendor.data.onboardingStatus ?? 'INCOMPLETE'}
              onChange={(e) =>
                apiRequest(`/vendors/${id}`, {
                  method: 'PATCH',
                  body: JSON.stringify({
                    onboardingStatus: e.target.value,
                    status:
                      e.target.value === 'APPROVED'
                        ? 'ACTIVE'
                        : e.target.value === 'REJECTED'
                          ? 'INACTIVE'
                          : undefined,
                  }),
                }).then(async () => {
                  await qc.invalidateQueries({ queryKey: ['vendor', id] });
                  await qc.invalidateQueries({ queryKey: ['vendors'] });
                })
              }
            >
              <option value="INCOMPLETE">INCOMPLETE</option>
              <option value="PENDING_REVIEW">PENDING_REVIEW</option>
              <option value="APPROVED">APPROVED</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </label>
          <div style={{ gridColumn: '1 / -1' }}>
            <strong>Owner</strong>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 8, marginTop: 8, fontSize: 14 }}>
              <div>Name: {vendor.data.documents?.ownerName ?? '—'}</div>
              <div>Phone: {vendor.data.documents?.ownerPhone ?? '—'}</div>
              <div>PAN: {vendor.data.documents?.ownerPan ?? '—'}</div>
              <div>ID: {vendor.data.documents?.idProofType ?? '—'} {vendor.data.documents?.idProofNumber ?? ''}</div>
            </div>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <strong>Licenses</strong>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 8, marginTop: 8, fontSize: 14 }}>
              <div>FSSAI: {vendor.data.documents?.fssaiLicense ?? '—'}</div>
              <div>FSSAI expiry: {vendor.data.documents?.fssaiExpiry ?? '—'}</div>
              <div>
                GSTIN:{' '}
                {vendor.data.documents?.gstExempt
                  ? 'Exempt'
                  : (vendor.data.documents?.gstin ?? '—')}
              </div>
            </div>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <strong>Bank payout</strong>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 8, marginTop: 8, fontSize: 14 }}>
              <div>{vendor.data.documents?.bankAccountName ?? '—'}</div>
              <div>A/C {vendor.data.documents?.bankAccountNumber ?? '—'}</div>
              <div>IFSC {vendor.data.documents?.bankIfsc ?? '—'}</div>
            </div>
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 14 }}>
            {vendor.data.documents?.fssaiDocUrl ? (
              <a href={vendor.data.documents.fssaiDocUrl} target="_blank" rel="noreferrer">
                FSSAI scan
              </a>
            ) : null}
            {vendor.data.documents?.gstDocUrl ? (
              <a href={vendor.data.documents.gstDocUrl} target="_blank" rel="noreferrer">
                GST scan
              </a>
            ) : null}
            {vendor.data.documents?.panDocUrl ? (
              <a href={vendor.data.documents.panDocUrl} target="_blank" rel="noreferrer">
                PAN scan
              </a>
            ) : null}
            {vendor.data.documents?.bankDocUrl ? (
              <a href={vendor.data.documents.bankDocUrl} target="_blank" rel="noreferrer">
                Bank proof
              </a>
            ) : null}
            {vendor.data.documents?.idProofDocUrl ? (
              <a href={vendor.data.documents.idProofDocUrl} target="_blank" rel="noreferrer">
                ID proof
              </a>
            ) : null}
            {vendor.data.documents?.shopPhotoUrl ? (
              <a href={vendor.data.documents.shopPhotoUrl} target="_blank" rel="noreferrer">
                Shop photo
              </a>
            ) : null}
            {!vendor.data.documents ? <span className="muted">No KYC documents on file.</span> : null}
          </div>
        </div>
      ) : null}

      {tab === 'overview' ? (
        <div className="panel form-grid">
          <h2>Restaurant details</h2>
          <p style={{ gridColumn: '1 / -1', color: 'var(--fm-muted)', fontSize: 14 }}>
            All fields save to the database and drive the mobile restaurant list and cuisine filters.
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
            </span>
          </label>
          <fieldset style={{ gridColumn: '1 / -1', border: '1px solid var(--fm-border, #ddd)', padding: 12 }}>
            <legend>Cuisine tags</legend>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {CUISINE_OPTIONS.map((c) => (
                <label key={c.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={cuisineTags.includes(c.id)}
                    onChange={() => toggleCuisine(c.id)}
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label>
            Diet type
            <select value={dietType} onChange={(e) => setDietType(e.target.value as typeof dietType)}>
              <option value="veg">Veg only</option>
              <option value="nonveg">Non-veg only</option>
              <option value="both">Veg & Non-veg</option>
            </select>
          </label>
          <label style={{ gridColumn: '1 / -1' }}>
            Image URL
            <input
              placeholder="https://… (shown on home & restaurants list)"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </label>
          {imageUrl.trim() ? (
            <div style={{ gridColumn: '1 / -1' }}>
              <img
                src={imageUrl.trim()}
                alt=""
                style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 12 }}
              />
            </div>
          ) : null}
          {saveMessage ? (
            <p style={{ gridColumn: '1 / -1', color: saveMessage.includes('saved') || saveMessage.includes('Restaurant') ? 'green' : 'crimson' }}>
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
              {saveVendor.isPending ? 'Saving…' : 'Save restaurant'}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={deleteVendor.isPending}
              onClick={() => {
                if (
                  !window.confirm(
                    'Deactivate this restaurant? It will be hidden from customers.',
                  )
                ) {
                  return;
                }
                setSaveMessage(null);
                deleteVendor.mutate();
              }}
            >
              {deleteVendor.isPending ? 'Deactivating…' : 'Deactivate'}
            </button>
          </div>
        </div>
      ) : null}

      {tab === 'products' ? (
        <>
          <div className="panel form-grid">
            <h2>Add menu item</h2>
            <p style={{ gridColumn: '1 / -1', color: 'var(--fm-muted)', fontSize: 14 }}>
              Map a catalog product to this restaurant. Selling price and MRP are per restaurant —
              mobile shows discount from MRP − selling price.
            </p>
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
              Vendor cost
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
            <p style={{ gridColumn: '1 / -1', fontSize: 13, color: 'var(--fm-muted)' }}>
              Preview discount:{' '}
              <strong>{discountPct(Number(mrp) || 0, Number(sellingPrice) || 0)}% OFF</strong>
            </p>
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
              Add to menu
            </button>
          </div>

          <h2>Restaurant menu (from DB)</h2>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Variant</th>
                <th>Selling</th>
                <th>MRP</th>
                <th>Discount</th>
                <th>Active</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(vendorProducts.data ?? []).map((row) => {
                const editing = editId === row._id;
                return (
                  <tr key={row._id}>
                    <td>{row.productId.name.en}</td>
                    <td>{row.variantId.name.en}</td>
                    <td>
                      {editing ? (
                        <input
                          style={{ width: 80 }}
                          value={editSelling}
                          onChange={(e) => setEditSelling(e.target.value)}
                        />
                      ) : (
                        `₹${row.sellingPrice}`
                      )}
                    </td>
                    <td>
                      {editing ? (
                        <input
                          style={{ width: 80 }}
                          value={editMrp}
                          onChange={(e) => setEditMrp(e.target.value)}
                        />
                      ) : (
                        `₹${row.mrp}`
                      )}
                    </td>
                    <td>
                      {editing
                        ? `${discountPct(Number(editMrp) || 0, Number(editSelling) || 0)}%`
                        : `${discountPct(row.mrp, row.sellingPrice)}%`}
                    </td>
                    <td>{row.isActive ? 'Yes' : 'No'}</td>
                    <td style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {editing ? (
                        <>
                          <button
                            type="button"
                            className="btn"
                            disabled={updatePrice.isPending}
                            onClick={() =>
                              updatePrice.mutate({
                                mappingId: row._id,
                                mrp: Number(editMrp),
                                sellingPrice: Number(editSelling),
                                vendorPrice: Number(editVendorPrice) || Number(editSelling),
                              })
                            }
                          >
                            Save
                          </button>
                          <button type="button" className="btn btn--ghost" onClick={() => setEditId(null)}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn btn--ghost"
                            onClick={() => {
                              setEditId(row._id);
                              setEditMrp(String(row.mrp));
                              setEditSelling(String(row.sellingPrice));
                              setEditVendorPrice(String(row.vendorPrice));
                            }}
                          >
                            Edit price
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost"
                            onClick={() => removeMapping.mutate(row._id)}
                          >
                            Remove
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      ) : null}
    </div>
  );
}
