import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Fragment, useState } from 'react';
import { apiRequest } from '../api/client';

type DeliveryDocuments = {
  aadhaarNumber?: string;
  drivingLicenseNumber?: string;
  vehicleRcNumber?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  insuranceNumber?: string;
  aadhaarDocUrl?: string;
  licenseDocUrl?: string;
  rcDocUrl?: string;
  photoUrl?: string;
};

type Row = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  accountActive: boolean;
  approvalStatus: string;
  availability: 'ONLINE' | 'OFFLINE';
  onboardingComplete?: boolean;
  lastSeenAt?: string;
  vehicleType?: string;
  serviceAreaIds?: string[];
  documents?: DeliveryDocuments | null;
  activeOrder: { id?: string; orderNumber: string; status: string } | null;
  todayDeliveries: number;
  todayEarnings: number;
};

const emptyDocs = {
  aadhaarNumber: '',
  drivingLicenseNumber: '',
  vehicleRcNumber: '',
  bankAccountName: '',
  bankAccountNumber: '',
  bankIfsc: '',
  insuranceNumber: '',
  aadhaarDocUrl: '',
  licenseDocUrl: '',
  rcDocUrl: '',
  photoUrl: '',
};

function ago(value?: string) {
  if (!value) return 'Never';
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hours ago`;
  return new Date(value).toLocaleString();
}

function maskAadhaar(value?: string) {
  if (!value || value.length < 4) return '—';
  return `XXXX-XXXX-${value.slice(-4)}`;
}

export function DeliveryPeoplePage() {
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleType, setVehicleType] = useState('BIKE');
  const [docs, setDocs] = useState(emptyDocs);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const areas = useQuery({
    queryKey: ['delivery-service-areas'],
    queryFn: async () => {
      const rows = await apiRequest<Array<{ key: string; value: Array<{ id: string; name: string; radiusKm: number; active?: boolean }> }>>(
        '/configuration',
      );
      const row = rows.find((r) => r.key === 'delivery.serviceAreas');
      return (row?.value ?? []).filter((a) => a.active !== false);
    },
  });

  const list = useQuery({
    queryKey: ['delivery-people'],
    queryFn: () => apiRequest<Row[]>('/delivery/persons'),
    refetchInterval: 15000,
  });

  function setDoc<K extends keyof typeof emptyDocs>(key: K, value: string) {
    setDocs((prev) => ({ ...prev, [key]: value }));
  }

  const docsReady =
    /^[2-9]\d{11}$/.test(docs.aadhaarNumber.replace(/\s/g, '')) &&
    docs.drivingLicenseNumber.trim().length >= 8 &&
    docs.vehicleRcNumber.trim().length >= 6 &&
    docs.bankAccountName.trim().length >= 2 &&
    docs.bankAccountNumber.trim().length >= 8 &&
    /^[A-Z]{4}0[A-Z0-9]{6}$/i.test(docs.bankIfsc.trim()) &&
    /^[6-9]\d{9}$/.test(phone.trim());

  const create = useMutation({
    mutationFn: () =>
      apiRequest('/delivery/persons', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim() || undefined,
          phone: phone.trim(),
          vehicleType,
          approve: true,
          documents: {
            aadhaarNumber: docs.aadhaarNumber.replace(/\s/g, ''),
            drivingLicenseNumber: docs.drivingLicenseNumber.trim().toUpperCase(),
            vehicleRcNumber: docs.vehicleRcNumber.trim().toUpperCase(),
            bankAccountName: docs.bankAccountName.trim(),
            bankAccountNumber: docs.bankAccountNumber.trim(),
            bankIfsc: docs.bankIfsc.trim().toUpperCase(),
            insuranceNumber: docs.insuranceNumber.trim() || undefined,
            aadhaarDocUrl: docs.aadhaarDocUrl.trim() || undefined,
            licenseDocUrl: docs.licenseDocUrl.trim() || undefined,
            rcDocUrl: docs.rcDocUrl.trim() || undefined,
            photoUrl: docs.photoUrl.trim() || undefined,
          },
        }),
      }),
    onSuccess: () => {
      setEmail('');
      setPassword('');
      setFirstName('');
      setLastName('');
      setPhone('');
      setVehicleType('BIKE');
      setDocs(emptyDocs);
      setError(null);
      qc.invalidateQueries({ queryKey: ['delivery-people'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const patch = useMutation({
    mutationFn: (input: { id: string; body: Record<string, unknown> }) =>
      apiRequest(`/delivery/persons/${input.id}`, {
        method: 'PATCH',
        body: JSON.stringify(input.body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['delivery-people'] }),
  });

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1>Delivery partners</h1>
          <p className="page-lead">
            Onboard riders with mandatory Aadhaar, driving license, vehicle RC, and bank details.
            When a rider goes online, the app reads their GPS. They only receive orders whose drop-off
            is in the same launch area as that live location.
          </p>
        </div>
        <button type="button" className="secondary" onClick={() => list.refetch()}>
          Refresh
        </button>
      </div>

      <div className="panel">
        <h2>Add delivery person</h2>
        <div className="form-grid-2">
          <label>
            First name *
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </label>
          <label>
            Last name
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </label>
          <label>
            Email *
            <input value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Password *
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <label>
            Phone *
            <input
              placeholder="10-digit mobile"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            />
          </label>
          <label>
            Vehicle *
            <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
              <option value="BIKE">Bike</option>
              <option value="SCOOTER">Scooter</option>
              <option value="CYCLE">Cycle</option>
              <option value="CAR">Car</option>
              <option value="EV">EV</option>
            </select>
          </label>
        </div>

        <h3 style={{ marginTop: 20 }}>Mandatory documents</h3>
        <div className="form-grid-2">
          <label>
            Aadhaar number *
            <input
              placeholder="12 digits"
              value={docs.aadhaarNumber}
              onChange={(e) => setDoc('aadhaarNumber', e.target.value.replace(/\D/g, '').slice(0, 12))}
            />
          </label>
          <label>
            Driving license *
            <input
              value={docs.drivingLicenseNumber}
              onChange={(e) => setDoc('drivingLicenseNumber', e.target.value.toUpperCase())}
            />
          </label>
          <label>
            Vehicle RC number *
            <input
              value={docs.vehicleRcNumber}
              onChange={(e) => setDoc('vehicleRcNumber', e.target.value.toUpperCase())}
            />
          </label>
          <label>
            Insurance number
            <input value={docs.insuranceNumber} onChange={(e) => setDoc('insuranceNumber', e.target.value)} />
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
            Aadhaar scan URL
            <input value={docs.aadhaarDocUrl} onChange={(e) => setDoc('aadhaarDocUrl', e.target.value)} />
          </label>
          <label>
            License scan URL
            <input value={docs.licenseDocUrl} onChange={(e) => setDoc('licenseDocUrl', e.target.value)} />
          </label>
          <label>
            RC scan URL
            <input value={docs.rcDocUrl} onChange={(e) => setDoc('rcDocUrl', e.target.value)} />
          </label>
          <label>
            Rider photo URL
            <input value={docs.photoUrl} onChange={(e) => setDoc('photoUrl', e.target.value)} />
          </label>
        </div>
        {error ? <p className="error">{error}</p> : null}
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            disabled={
              create.isPending ||
              !email ||
              !password ||
              !firstName ||
              password.length < 8 ||
              !docsReady
            }
            onClick={() => create.mutate()}
          >
            {create.isPending ? 'Saving…' : 'Create and approve with KYC'}
          </button>
        </div>
      </div>

      {list.isLoading ? <p className="muted">Loading…</p> : null}
      {list.isError ? <p className="error">Could not load delivery partners.</p> : null}

      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Partner</th>
              <th>KYC</th>
              <th>Live area</th>
              <th>Status</th>
              <th>Active order</th>
              <th>Last seen</th>
              <th>Today</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(list.data ?? []).map((row) => (
              <Fragment key={row.id}>
                <tr>
                  <td>
                    <strong>{row.name || row.email}</strong>
                    <div className="muted" style={{ fontSize: 13 }}>
                      {row.email}
                      {row.phone ? ` · ${row.phone}` : ''}
                      {row.vehicleType ? ` · ${row.vehicleType}` : ''}
                    </div>
                  </td>
                  <td>
                    {row.documents?.aadhaarNumber ? (
                      <>
                        <div>{maskAadhaar(row.documents.aadhaarNumber)}</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          DL {row.documents.drivingLicenseNumber ?? '—'} · RC{' '}
                          {row.documents.vehicleRcNumber ?? '—'}
                        </div>
                      </>
                    ) : (
                      <span className="muted">No docs</span>
                    )}
                    <button
                      type="button"
                      className="secondary"
                      style={{ marginTop: 6, fontSize: 12 }}
                      onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                    >
                      {expandedId === row.id ? 'Hide docs' : 'View docs'}
                    </button>
                  </td>
                  <td>
                    {(row.serviceAreaIds ?? []).length
                      ? (row.serviceAreaIds ?? [])
                          .map((id) => areas.data?.find((a) => a.id === id)?.name ?? id)
                          .join(', ')
                      : row.availability === 'ONLINE'
                        ? 'Outside zones'
                        : '—'}
                  </td>
                  <td>
                    <span className={`status-pill ${row.availability === 'ONLINE' ? 'success' : 'info'}`}>
                      {row.availability === 'ONLINE' ? 'Online' : 'Offline'}
                    </span>
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      {row.approvalStatus}
                      {row.onboardingComplete ? '' : ' · onboarding incomplete'}
                      {row.accountActive ? '' : ' · inactive'}
                    </div>
                  </td>
                  <td>
                    {row.activeOrder ? (
                      row.activeOrder.id ? (
                        <Link to={`/orders/${row.activeOrder.id}`}>#{row.activeOrder.orderNumber}</Link>
                      ) : (
                        `#${row.activeOrder.orderNumber}`
                      )
                    ) : (
                      <span className="muted">None</span>
                    )}
                  </td>
                  <td>{ago(row.lastSeenAt)}</td>
                  <td>
                    {row.todayDeliveries} deliveries
                    <div>₹{Math.round(row.todayEarnings)}</div>
                  </td>
                  <td>
                    <div className="row-actions">
                      {row.approvalStatus !== 'APPROVED' ? (
                        <button
                          type="button"
                          className="accent"
                          onClick={() => patch.mutate({ id: row.id, body: { approvalStatus: 'APPROVED' } })}
                        >
                          Approve
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="danger"
                          onClick={() =>
                            patch.mutate({
                              id: row.id,
                              body: { approvalStatus: 'REJECTED', rejectionReason: 'Rejected by admin' },
                            })
                          }
                        >
                          Reject
                        </button>
                      )}
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => patch.mutate({ id: row.id, body: { isActive: !row.accountActive } })}
                      >
                        {row.accountActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedId === row.id && row.documents ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="panel-soft" style={{ padding: 12, fontSize: 13 }}>
                        <strong>KYC pack</strong>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 8, marginTop: 8 }}>
                          <div>Aadhaar: {maskAadhaar(row.documents.aadhaarNumber)}</div>
                          <div>DL: {row.documents.drivingLicenseNumber ?? '—'}</div>
                          <div>RC: {row.documents.vehicleRcNumber ?? '—'}</div>
                          <div>Bank: {row.documents.bankAccountName ?? '—'}</div>
                          <div>A/C: {row.documents.bankAccountNumber ?? '—'}</div>
                          <div>IFSC: {row.documents.bankIfsc ?? '—'}</div>
                          {row.documents.aadhaarDocUrl ? (
                            <a href={row.documents.aadhaarDocUrl} target="_blank" rel="noreferrer">
                              Aadhaar scan
                            </a>
                          ) : null}
                          {row.documents.licenseDocUrl ? (
                            <a href={row.documents.licenseDocUrl} target="_blank" rel="noreferrer">
                              License scan
                            </a>
                          ) : null}
                          {row.documents.rcDocUrl ? (
                            <a href={row.documents.rcDocUrl} target="_blank" rel="noreferrer">
                              RC scan
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
