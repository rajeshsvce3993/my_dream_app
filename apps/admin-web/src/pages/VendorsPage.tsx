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
  deliveryRadiusKm?: number;
  serviceAreaWideDelivery?: boolean;
  location?: { coordinates: [number, number] };
  address?: { city?: string };
};

export function VendorsPage() {
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE' | 'SUSPENDED'>('ACTIVE');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [deliveryRadiusKm, setDeliveryRadiusKm] = useState('15');
  const [city, setCity] = useState('');
  const [serviceAreaWideDelivery, setServiceAreaWideDelivery] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => apiRequest<Vendor[]>('/vendors?limit=100'),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const lat = Number(latitude);
      const lng = Number(longitude);
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        throw new Error('Latitude and longitude must be valid numbers');
      }
      return apiRequest('/vendors', {
        method: 'POST',
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          status,
          latitude: lat,
          longitude: lng,
          deliveryRadiusKm: Number(deliveryRadiusKm) || 15,
          serviceAreaRadiusKm: Number(deliveryRadiusKm) || 15,
          address: city.trim() ? { city: city.trim(), country: 'IN' } : undefined,
          serviceAreaWideDelivery,
        }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendors'] });
      setCode('');
      setName('');
      setLatitude('');
      setLongitude('');
      setCity('');
      setServiceAreaWideDelivery(false);
      setFormError(null);
    },
    onError: (err: Error) => setFormError(err.message),
  });

  return (
    <div>
      <h1>Vendors</h1>
      <p style={{ maxWidth: 720, color: 'var(--fm-muted)', marginBottom: 16 }}>
        Store location uses <strong>latitude</strong> and <strong>longitude</strong>. Customer apps show vendors
        within each store&apos;s delivery radius from the customer&apos;s saved delivery coordinates.
      </p>

      <div className="panel form-grid" style={{ marginBottom: 24 }}>
        <h2>Add vendor</h2>
        <label>
          Code
          <input placeholder="STORE-01" value={code} onChange={(e) => setCode(e.target.value)} />
        </label>
        <label>
          Name
          <input placeholder="Fresh Mart Anna Nagar" value={name} onChange={(e) => setName(e.target.value)} />
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
          City (optional)
          <input placeholder="Chennai" value={city} onChange={(e) => setCity(e.target.value)} />
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
        <label>
          Delivery radius (km)
          <input
            inputMode="numeric"
            value={deliveryRadiusKm}
            onChange={(e) => setDeliveryRadiusKm(e.target.value)}
            disabled={serviceAreaWideDelivery}
          />
        </label>
        <label style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={serviceAreaWideDelivery}
            onChange={(e) => setServiceAreaWideDelivery(e.target.checked)}
          />
          Service-area delivery (no radius limit inside platform zone)
        </label>
        <p style={{ fontSize: 12, color: 'var(--fm-muted)', gridColumn: '1 / -1' }}>
          Tip: pick coordinates from Google Maps (right-click → copy lat/lng). Order in API is{' '}
          <code>[longitude, latitude]</code>.
        </p>
        {formError ? <p className="error">{formError}</p> : null}
        <button
          type="button"
          className="btn"
          disabled={!code || !name || !latitude || !longitude || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          {createMutation.isPending ? 'Creating…' : 'Create vendor'}
        </button>
      </div>

      {isLoading ? (
        <p>Loading…</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>City</th>
              <th>Lat / Lng</th>
              <th>Radius (km)</th>
              <th>Zone-wide</th>
              <th>Status</th>
              <th>Rating</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((v) => {
              const [lng, lat] = v.location?.coordinates ?? [];
              return (
                <tr key={v._id}>
                  <td>{v.code}</td>
                  <td>{v.name}</td>
                  <td>{v.address?.city ?? '—'}</td>
                  <td>
                    {lat !== undefined && lng !== undefined ? (
                      <code>
                        {lat.toFixed(4)}, {lng.toFixed(4)}
                      </code>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{v.serviceAreaWideDelivery ? '—' : (v.deliveryRadiusKm ?? '—')}</td>
                  <td>{v.serviceAreaWideDelivery ? 'Yes' : 'No'}</td>
                  <td>{v.status}</td>
                  <td>{v.rating}</td>
                  <td>
                    <Link to={`/vendors/${v._id}`}>Manage</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
