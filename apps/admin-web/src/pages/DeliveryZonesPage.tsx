import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api/client';

type ServiceArea = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  active?: boolean;
};

type ConfigRow = { key: string; value: ServiceArea[] };

export function DeliveryZonesPage() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radiusKm, setRadiusKm] = useState('15');
  const [message, setMessage] = useState<string | null>(null);

  const config = useQuery({
    queryKey: ['delivery-service-areas'],
    queryFn: async () => {
      const rows = await apiRequest<ConfigRow[]>('/configuration');
      const row = rows.find((r) => r.key === 'delivery.serviceAreas');
      return (row?.value ?? []) as ServiceArea[];
    },
  });

  const save = useMutation({
    mutationFn: (areas: ServiceArea[]) =>
      apiRequest('/configuration/delivery.serviceAreas', {
        method: 'PATCH',
        body: JSON.stringify({ value: areas }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delivery-service-areas'] });
      setMessage('Service areas saved.');
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const areas = config.data ?? [];

  function addArea() {
    const lat = Number(latitude);
    const lng = Number(longitude);
    const radius = Number(radiusKm);
    if (!name.trim() || Number.isNaN(lat) || Number.isNaN(lng) || Number.isNaN(radius)) {
      setMessage('Fill name, latitude, longitude, and radius.');
      return;
    }
    const id = name.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 40);
    const next = [
      ...areas,
      { id, name: name.trim(), latitude: lat, longitude: lng, radiusKm: radius, active: true },
    ];
    save.mutate(next);
    setName('');
    setLatitude('');
    setLongitude('');
    setRadiusKm('15');
  }

  function removeArea(id: string) {
    save.mutate(areas.filter((a) => a.id !== id));
  }

  function toggleActive(id: string) {
    save.mutate(
      areas.map((a) => (a.id === id ? { ...a, active: a.active === false ? true : false } : a)),
    );
  }

  return (
    <div>
      <p>
        <Link to="/configuration">Configuration</Link> · Delivery
      </p>
      <h1>Delivery service areas</h1>
      <p style={{ maxWidth: 720, color: 'var(--fm-muted)' }}>
        Define where customers may order. Their delivery address must fall inside <strong>at least one</strong>{' '}
        active zone below. Then a <strong>vendor</strong> must also cover them (see{' '}
        <Link to="/vendors">Vendors</Link> → lat/lng + delivery radius). Leave this list empty to allow any
        location (vendor rules only).
      </p>

      <div className="panel form-grid" style={{ marginBottom: 24 }}>
        <h2>Add zone</h2>
        <label>
          Zone name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Chennai — Anna Nagar" />
        </label>
        <label>
          Latitude
          <input value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="13.0827" />
        </label>
        <label>
          Longitude
          <input value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="80.2707" />
        </label>
        <label>
          Radius (km)
          <input value={radiusKm} onChange={(e) => setRadiusKm(e.target.value)} />
        </label>
        <button type="button" className="btn" onClick={addArea} disabled={save.isPending}>
          Add zone
        </button>
      </div>

      {message ? <p>{message}</p> : null}

      <h2>Active zones</h2>
      {config.isLoading ? (
        <p>Loading…</p>
      ) : areas.length === 0 ? (
        <p>No platform zones — only per-vendor radius applies.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Center (lat, lng)</th>
              <th>Radius (km)</th>
              <th>Active</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {areas.map((a) => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td>
                  <code>
                    {a.latitude}, {a.longitude}
                  </code>
                </td>
                <td>{a.radiusKm}</td>
                <td>{a.active !== false ? 'Yes' : 'No'}</td>
                <td>
                  <button type="button" className="btn btn--ghost" onClick={() => toggleActive(a.id)}>
                    Toggle
                  </button>{' '}
                  <button type="button" className="btn btn--ghost" onClick={() => removeArea(a.id)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p style={{ marginTop: 24, fontSize: 13, color: 'var(--fm-muted)' }}>
        Global search cap: <code>vendor.search.maxRadiusKm</code> in{' '}
        <Link to="/configuration">Configuration</Link> (vendor category).
      </p>
    </div>
  );
}
