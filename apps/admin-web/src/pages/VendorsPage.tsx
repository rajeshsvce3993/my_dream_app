import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { apiRequest } from '../api/client';

type Vendor = {
  _id: string;
  code: string;
  name: string;
  status: string;
  rating: number;
  commissionRate?: number;
  gstEnabled?: boolean;
  gstPercent?: number;
  deliveryRadiusKm?: number;
  serviceAreaWideDelivery?: boolean;
  cuisineTags?: string[];
  imageUrl?: string;
  onboardingStatus?: string;
  onboardingComplete?: boolean;
  location?: { coordinates: [number, number] };
  address?: { line1?: string; city?: string; state?: string; postalCode?: string };
  documents?: { ownerName?: string; fssaiLicense?: string; gstin?: string };
};

const CUISINE_OPTIONS = [
  { id: 'south-indian', label: 'South Indian' },
  { id: 'chinese', label: 'Chinese' },
  { id: 'fast-food', label: 'Fast Food' },
];

const emptyDocs = {
  ownerName: '',
  ownerPhone: '',
  ownerPan: '',
  gstin: '',
  gstExempt: false,
  fssaiLicense: '',
  fssaiExpiry: '',
  bankAccountName: '',
  bankAccountNumber: '',
  bankIfsc: '',
  idProofType: 'AADHAAR' as 'AADHAAR' | 'PASSPORT' | 'VOTER' | 'DL',
  idProofNumber: '',
  fssaiDocUrl: '',
  gstDocUrl: '',
  panDocUrl: '',
  bankDocUrl: '',
  idProofDocUrl: '',
  shopPhotoUrl: '',
};

export function VendorsPage() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE' | 'SUSPENDED'>('ACTIVE');
  const [serviceCharge, setServiceCharge] = useState('10');
  const [gstEnabled, setGstEnabled] = useState(false);
  const [gstPercent, setGstPercent] = useState('5');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('India');
  const [cuisineTags, setCuisineTags] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState('');
  const [docs, setDocs] = useState(emptyDocs);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => apiRequest<Vendor[]>('/vendors?limit=100'),
  });

  function toggleCuisine(tag: string) {
    setCuisineTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  function setDoc<K extends keyof typeof emptyDocs>(key: K, value: (typeof emptyDocs)[K]) {
    setDocs((prev) => ({ ...prev, [key]: value }));
  }

  const docsReady =
    docs.ownerName.trim().length >= 2 &&
    /^[6-9]\d{9}$/.test(docs.ownerPhone.trim()) &&
    /^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(docs.ownerPan.trim()) &&
    docs.fssaiLicense.trim().length >= 8 &&
    docs.bankAccountName.trim().length >= 2 &&
    docs.bankAccountNumber.trim().length >= 8 &&
    /^[A-Z]{4}0[A-Z0-9]{6}$/i.test(docs.bankIfsc.trim()) &&
    docs.idProofNumber.trim().length >= 4 &&
    (docs.gstExempt || docs.gstin.trim().length >= 15) &&
    line1.trim().length >= 3 &&
    city.trim().length >= 2 &&
    stateName.trim().length >= 2 &&
    /^\d{6}$/.test(postalCode.trim());

  const createMutation = useMutation({
    mutationFn: () => {
      const lat = Number(latitude);
      const lng = Number(longitude);
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        throw new Error('Latitude and longitude must be valid numbers');
      }
      const commissionRate = Number(serviceCharge);
      if (serviceCharge.trim() === '' || Number.isNaN(commissionRate) || commissionRate < 0 || commissionRate > 100) {
        throw new Error('Service charge must be a percentage from 0 to 100');
      }
      const gstRate = Number(gstPercent);
      if (gstEnabled && (gstPercent.trim() === '' || Number.isNaN(gstRate) || gstRate < 0 || gstRate > 100)) {
        throw new Error('GST must be a percentage from 0 to 100');
      }
      return apiRequest('/vendors', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          status,
          commissionRate,
          gstEnabled,
          gstPercent: Number.isFinite(gstRate) ? gstRate : 5,
          latitude: lat,
          longitude: lng,
          address: {
            line1: line1.trim(),
            line2: line2.trim() || undefined,
            city: city.trim(),
            state: stateName.trim(),
            postalCode: postalCode.trim(),
            country: country.trim() || 'India',
          },
          cuisineTags,
          imageUrl: imageUrl.trim() || docs.shopPhotoUrl.trim() || undefined,
          phone: docs.ownerPhone.trim(),
          approveOnboarding: true,
          documents: {
            ownerName: docs.ownerName.trim(),
            ownerPhone: docs.ownerPhone.trim(),
            ownerPan: docs.ownerPan.trim().toUpperCase(),
            gstin: docs.gstExempt ? undefined : docs.gstin.trim().toUpperCase(),
            gstExempt: docs.gstExempt,
            fssaiLicense: docs.fssaiLicense.trim(),
            fssaiExpiry: docs.fssaiExpiry.trim() || undefined,
            bankAccountName: docs.bankAccountName.trim(),
            bankAccountNumber: docs.bankAccountNumber.trim(),
            bankIfsc: docs.bankIfsc.trim().toUpperCase(),
            idProofType: docs.idProofType,
            idProofNumber: docs.idProofNumber.trim(),
            fssaiDocUrl: docs.fssaiDocUrl.trim() || undefined,
            gstDocUrl: docs.gstDocUrl.trim() || undefined,
            panDocUrl: docs.panDocUrl.trim() || undefined,
            bankDocUrl: docs.bankDocUrl.trim() || undefined,
            idProofDocUrl: docs.idProofDocUrl.trim() || undefined,
            shopPhotoUrl: docs.shopPhotoUrl.trim() || undefined,
          },
        }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendors'] });
      setName('');
      setServiceCharge('10');
      setGstEnabled(false);
      setGstPercent('5');
      setLatitude('');
      setLongitude('');
      setLine1('');
      setCity('');
      setStateName('');
      setPostalCode('');
      setCuisineTags([]);
      setImageUrl('');
      setDocs(emptyDocs);
      setFormError(null);
    },
    onError: (err: Error) => setFormError(err.message),
  });

  return (
    <div>
      <h1>Vendor shops</h1>
      <p style={{ maxWidth: 720, color: 'var(--fm-muted)', marginBottom: 16 }}>
        Each shop is one vendor account. A unique vendor code is created automatically when the shop is saved.
        Owner KYC (PAN, FSSAI, bank, ID proof) is mandatory before the shop can go live. Staff logins are managed
        separately on the shop detail page.
      </p>

      <div className="panel form-grid" style={{ marginBottom: 24 }}>
        <h2>Add vendor shop</h2>
        <p style={{ gridColumn: '1 / -1', color: 'var(--fm-muted)', fontSize: 13, margin: 0 }}>
          Vendor code is assigned on save, for example VN-K7Q2MP.
        </p>
        <label>
          Shop name
          <input placeholder="Saravana South Kitchen" value={name} onChange={(e) => setName(e.target.value)} />
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
          Service charge (%)
          <input
            inputMode="decimal"
            placeholder="10"
            value={serviceCharge}
            onChange={(e) => setServiceCharge(e.target.value)}
          />
        </label>
        <p style={{ gridColumn: '1 / -1', color: 'var(--fm-muted)', fontSize: 13, margin: 0 }}>
          Taken from each order bill. A 10% charge on ₹200 leaves ₹180 for the shop and ₹20 for the platform.
        </p>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox"
            style={{ width: 'auto' }}
            checked={gstEnabled}
            onChange={(e) => setGstEnabled(e.target.checked)}
          />
          Charge GST on food items
        </label>
        <label>
          GST (%)
          <input
            type="number"
            min={0}
            max={100}
            step="0.01"
            disabled={!gstEnabled}
            value={gstPercent}
            onChange={(e) => setGstPercent(e.target.value)}
          />
        </label>
        <p style={{ gridColumn: '1 / -1', color: 'var(--fm-muted)', fontSize: 13, margin: 0 }}>
          Added on this shop’s food item price. Leave off if this menu’s prices already include tax. Each restaurant
          can use a different rate.
        </p>
        <label>
          Address line
          <input placeholder="12 Anna Salai" value={line1} onChange={(e) => setLine1(e.target.value)} />
        </label>
        <label>
          Address line 2
          <input
            placeholder="Area, landmark (optional)"
            value={line2}
            onChange={(e) => setLine2(e.target.value)}
          />
        </label>
        <label>
          City
          <input placeholder="Tiruvallur" value={city} onChange={(e) => setCity(e.target.value)} />
        </label>
        <label>
          State
          <input placeholder="Tamil Nadu" value={stateName} onChange={(e) => setStateName(e.target.value)} />
        </label>
        <label>
          PIN code
          <input placeholder="602001" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
        </label>
        <label>
          Country
          <input value={country} onChange={(e) => setCountry(e.target.value)} />
        </label>
        <label>
          Latitude
          <input
            inputMode="decimal"
            placeholder="13.0827"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
          />
        </label>
        <label>
          Longitude
          <input
            inputMode="decimal"
            placeholder="80.2707"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
          />
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
        <label style={{ gridColumn: '1 / -1' }}>
          Cover image URL
          <input
            placeholder="https://… (restaurant photo)"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
        </label>

        <h3 style={{ gridColumn: '1 / -1', margin: '8px 0 0' }}>Mandatory KYC documents</h3>
        <p style={{ gridColumn: '1 / -1', color: 'var(--fm-muted)', fontSize: 13, margin: 0 }}>
          Required for every shop: owner identity, FSSAI, bank payout details, and ID proof. GSTIN
          required unless GST exempt.
        </p>
        <label>
          Owner full name *
          <input value={docs.ownerName} onChange={(e) => setDoc('ownerName', e.target.value)} />
        </label>
        <label>
          Owner mobile *
          <input
            placeholder="10-digit"
            value={docs.ownerPhone}
            onChange={(e) => setDoc('ownerPhone', e.target.value.replace(/\D/g, '').slice(0, 10))}
          />
        </label>
        <label>
          Owner PAN *
          <input
            placeholder="ABCDE1234F"
            value={docs.ownerPan}
            onChange={(e) => setDoc('ownerPan', e.target.value.toUpperCase().slice(0, 10))}
          />
        </label>
        <label>
          FSSAI license *
          <input value={docs.fssaiLicense} onChange={(e) => setDoc('fssaiLicense', e.target.value)} />
        </label>
        <label>
          FSSAI expiry
          <input
            placeholder="YYYY-MM-DD"
            value={docs.fssaiExpiry}
            onChange={(e) => setDoc('fssaiExpiry', e.target.value)}
          />
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={docs.gstExempt}
            onChange={(e) => setDoc('gstExempt', e.target.checked)}
          />
          GST exempt
        </label>
        <label>
          GSTIN {!docs.gstExempt ? '*' : '(optional)'}
          <input
            placeholder="22AAAAA0000A1Z5"
            disabled={docs.gstExempt}
            value={docs.gstin}
            onChange={(e) => setDoc('gstin', e.target.value.toUpperCase().slice(0, 15))}
          />
        </label>
        <label>
          Bank account name *
          <input value={docs.bankAccountName} onChange={(e) => setDoc('bankAccountName', e.target.value)} />
        </label>
        <label>
          Bank account number *
          <input
            value={docs.bankAccountNumber}
            onChange={(e) => setDoc('bankAccountNumber', e.target.value.replace(/\s/g, ''))}
          />
        </label>
        <label>
          IFSC *
          <input
            placeholder="SBIN0001234"
            value={docs.bankIfsc}
            onChange={(e) => setDoc('bankIfsc', e.target.value.toUpperCase().slice(0, 11))}
          />
        </label>
        <label>
          ID proof type *
          <select
            value={docs.idProofType}
            onChange={(e) => setDoc('idProofType', e.target.value as typeof docs.idProofType)}
          >
            <option value="AADHAAR">Aadhaar</option>
            <option value="PASSPORT">Passport</option>
            <option value="VOTER">Voter ID</option>
            <option value="DL">Driving license</option>
          </select>
        </label>
        <label>
          ID proof number *
          <input value={docs.idProofNumber} onChange={(e) => setDoc('idProofNumber', e.target.value)} />
        </label>
        <label>
          FSSAI scan URL
          <input value={docs.fssaiDocUrl} onChange={(e) => setDoc('fssaiDocUrl', e.target.value)} />
        </label>
        <label>
          GST scan URL
          <input value={docs.gstDocUrl} onChange={(e) => setDoc('gstDocUrl', e.target.value)} />
        </label>
        <label>
          PAN scan URL
          <input value={docs.panDocUrl} onChange={(e) => setDoc('panDocUrl', e.target.value)} />
        </label>
        <label>
          Bank proof URL
          <input value={docs.bankDocUrl} onChange={(e) => setDoc('bankDocUrl', e.target.value)} />
        </label>
        <label>
          ID proof scan URL
          <input value={docs.idProofDocUrl} onChange={(e) => setDoc('idProofDocUrl', e.target.value)} />
        </label>
        <label>
          Shop photo URL
          <input value={docs.shopPhotoUrl} onChange={(e) => setDoc('shopPhotoUrl', e.target.value)} />
        </label>

        {formError ? <p className="error" style={{ gridColumn: '1 / -1' }}>{formError}</p> : null}
        <button
          type="button"
          className="btn"
          disabled={!name || !latitude || !longitude || !docsReady || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          {createMutation.isPending ? 'Creating…' : 'Create shop with KYC'}
        </button>
      </div>

      {isLoading ? (
        <p>Loading…</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Shop</th>
              <th>Owner / KYC</th>
              <th>Address</th>
              <th>Service charge</th>
              <th>GST</th>
              <th>Status</th>
              <th>Onboarding</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((v) => (
              <tr key={v._id}>
                <td>{v.code}</td>
                <td>{v.name}</td>
                <td>
                  {v.documents?.ownerName ?? '—'}
                  {v.documents?.fssaiLicense ? (
                    <div className="muted" style={{ fontSize: 12 }}>
                      FSSAI {v.documents.fssaiLicense}
                    </div>
                  ) : null}
                </td>
                <td>
                  {[v.address?.line1, v.address?.city, v.address?.postalCode].filter(Boolean).join(', ') || '—'}
                </td>
                <td>{v.commissionRate ?? 0}%</td>
                <td>{v.gstEnabled ? `${v.gstPercent ?? 0}%` : 'Off'}</td>
                <td>{v.status}</td>
                <td>
                  {v.onboardingStatus ?? (v.onboardingComplete === false ? 'INCOMPLETE' : '—')}
                </td>
                <td>
                  <Link to={`/vendors/${v._id}`}>Manage</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
