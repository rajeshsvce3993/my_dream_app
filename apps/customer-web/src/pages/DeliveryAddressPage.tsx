import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, LocateFixed, CheckCircle2 } from 'lucide-react';
import { apiRequest } from '../api/client';
import { useLocationContext, type DeliveryLocation } from '../context/LocationContext';
import { afterAuthNavigate } from '../lib/authReturn';

type AddressType = 'home' | 'work' | 'other';

export function DeliveryAddressPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = params.get('returnTo');
  const { setLocation } = useLocationContext();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [house, setHouse] = useState('');
  const [street, setStreet] = useState('');
  const [landmark, setLandmark] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [instructions, setInstructions] = useState('');
  const [addressType, setAddressType] = useState<AddressType>('home');
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();
  const [locMessage, setLocMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function useCurrentLocation() {
    setLocMessage(null);
    if (!navigator.geolocation) {
      setLocMessage('Location is not supported in this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setLocMessage('Location captured. Confirm your house / flat details.');
      },
      () => setLocMessage('Location permission denied. Enter your address manually.'),
    );
  }

  function validate() {
    const err: Record<string, string> = {};
    if (fullName.trim().length < 2) err.fullName = 'Enter your full name';
    if (house.trim().length < 2) err.house = 'Required';
    if (street.trim().length < 2) err.street = 'Required';
    if (city.trim().length < 2) err.city = 'Required';
    if (state.trim().length < 2) err.state = 'Required';
    if (!/^\d{6}$/.test(postalCode)) err.postalCode = 'Enter a valid 6-digit PIN code';
    setErrors(err);
    return Object.keys(err).length === 0;
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const created = await apiRequest<{
        line1: string;
        line2?: string;
        city: string;
        state: string;
        postalCode: string;
        lat?: number;
        lng?: number;
      }>('/customers/me/addresses', {
        method: 'POST',
        body: JSON.stringify({
          fullName: fullName.trim(),
          line1: house.trim(),
          line2: street.trim(),
          landmark: landmark.trim() || undefined,
          city: city.trim(),
          state: state.trim(),
          postalCode: postalCode.trim(),
          phone: phone.trim() || undefined,
          addressType,
          deliveryInstructions: instructions.trim() || undefined,
          lat,
          lng,
          country: 'India',
        }),
      });
      const line1 = [created.line1, created.line2].filter(Boolean).join(', ');
      const loc: DeliveryLocation = {
        label: `${created.city}, ${created.state}`,
        line1,
        city: created.city,
        lng: created.lng ?? lng ?? 79.9186027,
        lat: created.lat ?? lat ?? 13.1425869,
        country: 'IN',
      };
      setLocation(loc);
      setSaved(true);
      window.setTimeout(() => {
        afterAuthNavigate(navigate, false, returnTo);
      }, 600);
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : 'Could not save address' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="qc-auth qc-auth--address">
      <form className="qc-auth-card qc-auth-card--wide" onSubmit={save}>
        <Link to={returnTo ?? '/profile'} className="qc-auth-back" aria-label="Back">
          <ArrowLeft size={20} />
        </Link>
        <p className="qc-auth-emoji" aria-hidden>
          📍
        </p>
        <h1 className="qc-auth-title qc-auth-title--left">Where should we deliver?</h1>
        <p className="qc-auth-sub qc-auth-sub--left">
          Add your delivery address so we can show nearby stores and accurate delivery options.
        </p>

        <button type="button" className="qc-auth-locate" onClick={useCurrentLocation}>
          <LocateFixed size={18} /> Use my current location
        </button>
        {locMessage ? <p className="qc-auth-meta">{locMessage}</p> : null}

        <label className="qc-auth-label">Full name</label>
        <input className="qc-auth-input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        {errors.fullName ? <p className="qc-auth-error">{errors.fullName}</p> : null}

        <label className="qc-auth-label">Mobile number</label>
        <input
          className="qc-auth-input"
          inputMode="numeric"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
        />

        <span className="qc-auth-label">Address type</span>
        <div className="qc-auth-chips">
          {(['home', 'work', 'other'] as AddressType[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`qc-auth-chip ${addressType === t ? 'qc-auth-chip--active' : ''}`}
              onClick={() => setAddressType(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <label className="qc-auth-label">House / Flat / Building</label>
        <input className="qc-auth-input" value={house} onChange={(e) => setHouse(e.target.value)} />
        {errors.house ? <p className="qc-auth-error">{errors.house}</p> : null}

        <label className="qc-auth-label">Street / Area</label>
        <input className="qc-auth-input" value={street} onChange={(e) => setStreet(e.target.value)} />
        {errors.street ? <p className="qc-auth-error">{errors.street}</p> : null}

        <label className="qc-auth-label">Landmark (optional)</label>
        <input className="qc-auth-input" value={landmark} onChange={(e) => setLandmark(e.target.value)} />

        <div className="qc-auth-row">
          <div>
            <label className="qc-auth-label">City</label>
            <input className="qc-auth-input" value={city} onChange={(e) => setCity(e.target.value)} />
            {errors.city ? <p className="qc-auth-error">{errors.city}</p> : null}
          </div>
          <div>
            <label className="qc-auth-label">State</label>
            <input className="qc-auth-input" value={state} onChange={(e) => setState(e.target.value)} />
            {errors.state ? <p className="qc-auth-error">{errors.state}</p> : null}
          </div>
        </div>

        <label className="qc-auth-label">PIN code</label>
        <input
          className="qc-auth-input"
          inputMode="numeric"
          value={postalCode}
          onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        />
        {errors.postalCode ? <p className="qc-auth-error">{errors.postalCode}</p> : null}

        <label className="qc-auth-label">Delivery instructions (optional)</label>
        <textarea className="qc-auth-input qc-auth-textarea" value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} />

        {errors.form ? <p className="qc-auth-error">{errors.form}</p> : null}
        {saved ? (
          <p className="qc-auth-success">
            <CheckCircle2 size={18} /> Address saved
          </p>
        ) : null}

        <button type="submit" className="qc-btn qc-btn--primary qc-btn--block qc-auth-sticky" disabled={loading || saved}>
          {loading ? 'Saving…' : 'Save address'}
        </button>
      </form>
    </div>
  );
}
