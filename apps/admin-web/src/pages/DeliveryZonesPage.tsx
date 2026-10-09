import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api/client';

type ServiceArea = {
  id: string;
  name: string;
  code?: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  outsideKm?: number;
  active?: boolean;
};

function areaCode(area: ServiceArea, index: number): string {
  const digits = (area.code ?? '').replace(/\D/g, '');
  if (digits) return digits.padStart(2, '0');
  return String(index + 1).padStart(2, '0');
}

function withCodes(list: ServiceArea[]): ServiceArea[] {
  return list.map((area, index) => ({ ...area, code: areaCode(area, index) }));
}

function nextAreaCode(list: ServiceArea[]): string {
  const used = new Set(withCodes(list).map((area) => area.code));
  for (let n = 1; n < 100; n += 1) {
    const code = String(n).padStart(2, '0');
    if (!used.has(code)) return code;
  }
  return '99';
}

function duplicateCode(list: ServiceArea[]): string | null {
  const seen = new Set<string>();
  for (const area of withCodes(list)) {
    const code = area.code ?? '';
    if (!/^\d{2,3}$/.test(code)) return 'Area code must be 2 digits, such as 01 or 02.';
    if (seen.has(code)) return `Area code ${code} is already used. Each zone needs its own code.`;
    seen.add(code);
  }
  return null;
}

type ConfigRow = { key: string; value: unknown };

export function DeliveryZonesPage() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radiusKm, setRadiusKm] = useState('5');
  const [zoneOutsideKm, setZoneOutsideKm] = useState('3');
  const [editing, setEditing] = useState<{ id: string; field: 'radius' | 'outside' | 'code'; value: string } | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);

  const config = useQuery({
    queryKey: ['delivery-service-areas'],
    queryFn: async () => {
      const rows = await apiRequest<ConfigRow[]>('/configuration');
      const areasRow = rows.find((r) => r.key === 'delivery.serviceAreas');
      return (areasRow?.value ?? []) as ServiceArea[];
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
    const outside = Number(zoneOutsideKm);
    const zoneCode = (code.trim() || nextAreaCode(areas)).replace(/\D/g, '').padStart(2, '0');
    if (!/^\d{2,3}$/.test(zoneCode)) {
      setMessage('Area code must be 2 digits, such as 01 or 02.');
      return;
    }
    if (!name.trim() || Number.isNaN(lat) || Number.isNaN(lng) || Number.isNaN(radius) || Number.isNaN(outside)) {
      setMessage('Fill name, area code, latitude, longitude, radius, and outside limit.');
      return;
    }
    if (outside < 0) {
      setMessage('Outside limit must be 0 or more kilometres.');
      return;
    }
    const id = name.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 40);
    const next = withCodes([
      ...areas,
      {
        id,
        code: zoneCode,
        name: name.trim(),
        latitude: lat,
        longitude: lng,
        radiusKm: radius,
        outsideKm: outside,
        active: true,
      },
    ]);
    const duplicate = duplicateCode(next);
    if (duplicate) {
      setMessage(duplicate);
      return;
    }
    save.mutate(next);
    setName('');
    setCode('');
    setLatitude('');
    setLongitude('');
    setRadiusKm('5');
    setZoneOutsideKm('3');
  }

  function saveEdit() {
    if (!editing) return;
    if (editing.field === 'code') {
      const zoneCode = editing.value.replace(/\D/g, '').padStart(2, '0');
      if (!/^\d{2,3}$/.test(zoneCode)) {
        setMessage('Area code must be 2 digits, such as 01 or 02.');
        return;
      }
      const next = withCodes(areas.map((a) => (a.id === editing.id ? { ...a, code: zoneCode } : a)));
      const duplicate = duplicateCode(next);
      if (duplicate) {
        setMessage(duplicate);
        return;
      }
      save.mutate(next);
      setEditing(null);
      return;
    }
    const value = Number(editing.value);
    if (editing.field === 'radius' && (Number.isNaN(value) || value < 0.5)) {
      setMessage('Radius must be at least 0.5 km.');
      return;
    }
    if (editing.field === 'outside' && (Number.isNaN(value) || value < 0)) {
      setMessage('Outside limit must be 0 or more kilometres.');
      return;
    }
    save.mutate(
      withCodes(
        areas.map((a) =>
          a.id === editing.id
            ? editing.field === 'radius'
              ? { ...a, radiusKm: value }
              : { ...a, outsideKm: value }
            : a,
        ),
      ),
    );
    setEditing(null);
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
      <h1>Launch areas</h1>
      <p style={{ maxWidth: 720, color: 'var(--fm-muted)' }}>
        Each row is a launch circle stored in the database (<code>delivery.serviceAreas</code>).
        A customer can order only when their address is inside an active circle, and a restaurant
        appears only when its shop location is inside the <strong>same</strong> circle. Each zone has
        its own area code. Orders use <code>ORD</code> + that code + date + serial, for example{' '}
        <code>ORD01-20260110-001</code>. Area 01 and area 02 each start their own serial at 001 every
        day.
      </p>

      <div className="panel form-grid" style={{ marginBottom: 24 }}>
        <h2>Add zone</h2>
        <label>
          Zone name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Chennai — Anna Nagar" />
        </label>
        <label>
          Area code
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={nextAreaCode(areas)}
            maxLength={3}
          />
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
          <input value={radiusKm} onChange={(e) => setRadiusKm(e.target.value)} placeholder="5" />
        </label>
        <label>
          Rider outside limit (km)
          <input
            value={zoneOutsideKm}
            onChange={(e) => setZoneOutsideKm(e.target.value)}
            placeholder="3"
          />
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
              <th>Area code</th>
              <th>Name</th>
              <th>Center (lat, lng)</th>
              <th>Radius (km)</th>
              <th>Outside limit (km)</th>
              <th>Active</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {areas.map((a, index) => (
              <tr key={a.id}>
                <td>
                  {editing?.id === a.id && editing.field === 'code' ? (
                    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                      <input
                        style={{ width: 64 }}
                        value={editing.value}
                        onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                      />
                      <button type="button" className="btn" onClick={saveEdit}>
                        Save
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => setEditing({ id: a.id, field: 'code', value: areaCode(a, index) })}
                    >
                      {areaCode(a, index)}
                    </button>
                  )}
                </td>
                <td>{a.name}</td>
                <td>
                  <code>
                    {a.latitude}, {a.longitude}
                  </code>
                </td>
                <td>
                  {editing?.id === a.id && editing.field === 'radius' ? (
                    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                      <input
                        style={{ width: 72 }}
                        value={editing.value}
                        onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                      />
                      <button type="button" className="btn" onClick={saveEdit}>
                        Save
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => setEditing({ id: a.id, field: 'radius', value: String(a.radiusKm) })}
                    >
                      {a.radiusKm}
                    </button>
                  )}
                </td>
                <td>
                  {editing?.id === a.id && editing.field === 'outside' ? (
                    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                      <input
                        style={{ width: 72 }}
                        value={editing.value}
                        onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                      />
                      <button type="button" className="btn" onClick={saveEdit}>
                        Save
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() =>
                        setEditing({ id: a.id, field: 'outside', value: String(a.outsideKm ?? 0) })
                      }
                    >
                      {a.outsideKm ?? 0}
                    </button>
                  )}
                </td>
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
        Click an area code, radius, or outside limit to change it. Area code 01 and area code 02 each
        keep a separate order serial that starts at 001 every day. Outside limit is how far past that
        zone’s edge a rider may wait. An empty list means no launch restriction. Turn a zone off to
        pause it.
      </p>
    </div>
  );
}
