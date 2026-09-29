import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Truck, Wallet } from 'lucide-react';
import { apiRequest } from '../api/client';
import { OrderSummary } from '../components/OrderSummary';
import { useCart } from '../hooks/useCart';
import { useLocationContext } from '../context/LocationContext';
import { ErrorState } from '../design-system/ErrorState';
import { HomeFeedSkeleton } from '../design-system/Skeleton';
import { useLocale } from '../context/LocaleContext';

const steps = ['Address', 'Delivery', 'Payment', 'Review'];

type DeliveryOption = {
  id: string;
  label: { en: string; ta?: string };
  fee: number;
};

export function CheckoutPage() {
  const navigate = useNavigate();
  const { tName } = useLocale();
  const { location } = useLocationContext();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deliveryId, setDeliveryId] = useState('standard');
  const cart = useCart();

  const config = useQuery({
    queryKey: ['checkout-config'],
    queryFn: () => apiRequest<Record<string, unknown>>('/configuration/public'),
  });

  const deliveryOptions =
    (config.data?.['checkout.deliveryOptions'] as DeliveryOption[] | undefined) ?? [];

  async function placeOrder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await apiRequest<{ order: { _id: string } }>('/checkout', {
        method: 'POST',
        body: JSON.stringify({
          idempotencyKey: crypto.randomUUID(),
          paymentMethod: 'COD',
          deliveryAddress: {
            line1: location.line1 ?? location.label,
            city: location.city,
            country: 'IN',
            lng: location.lng,
            lat: location.lat,
          },
        }),
      });
      navigate(`/orders/${result.order._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (cart.isError) {
    return (
      <ErrorState
        message="Sign in to checkout."
        onRetry={() => navigate('/login?returnTo=/checkout')}
      />
    );
  }

  if (cart.isLoading) return <HomeFeedSkeleton />;

  return (
    <div className="qc-checkout">
      <h1 className="qc-greeting" style={{ fontSize: '1.5rem' }}>
        Checkout
      </h1>

      <div className="fm-checkout-steps fm-checkout-stepper">
        {steps.map((label, idx) => (
          <div key={label} className={`fm-step ${idx <= step ? 'active' : ''}`}>
            <span className="fm-step-num">{idx + 1}</span>
            {label}
          </div>
        ))}
      </div>

      <div className="fm-layout-split fm-checkout-layout">
        <form className="fm-checkout-main qc-checkout-form" onSubmit={placeOrder}>
          {step === 0 ? (
            <>
              <div className="fm-section-head">
                <h2 style={{ margin: 0 }}>Delivery address</h2>
              </div>
              <div className="fm-address-card selected">
                <MapPin size={18} aria-hidden />
                <strong>Delivering to</strong>
                <p>{location.label}</p>
                <p className="fm-muted-text">{location.city}</p>
              </div>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <h2>
                <Truck size={20} style={{ verticalAlign: 'middle' }} /> Delivery method
              </h2>
              {deliveryOptions.map((opt) => (
                <label
                  key={opt.id}
                  className={`fm-radio-card ${deliveryId === opt.id ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="delivery"
                    checked={deliveryId === opt.id}
                    onChange={() => setDeliveryId(opt.id)}
                  />
                  <div>
                    <strong>{tName(opt.label)}</strong>
                    <div className="fm-muted-text">
                      {opt.fee === 0 ? 'Free' : `₹${opt.fee}`}
                    </div>
                  </div>
                </label>
              ))}
            </>
          ) : null}

          {step === 2 ? (
            <>
              <h2>
                <Wallet size={20} style={{ verticalAlign: 'middle' }} /> Payment
              </h2>
              <div className="fm-radio-card selected">
                <strong>Cash on delivery</strong>
                <p className="fm-muted-text">Pay when your order arrives. Totals verified on the server.</p>
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <h2>Review & place order</h2>
              <p className="fm-muted-text">Confirm your address and items, then place the order.</p>
            </>
          ) : null}

          {error ? <p className="fm-error">{error}</p> : null}

          <div className="fm-checkout-actions">
            {step > 0 ? (
              <button type="button" className="qc-btn qc-btn--outline" onClick={() => setStep((s) => s - 1)}>
                Back
              </button>
            ) : null}
            {step < steps.length - 1 ? (
              <button type="button" className="qc-btn qc-btn--primary" onClick={() => setStep((s) => s + 1)}>
                Continue to {steps[step + 1]}
              </button>
            ) : (
              <button
                type="submit"
                className="qc-btn qc-btn--accent"
                disabled={loading || !cart.data?.lines.length}
              >
                {loading ? 'Placing order…' : 'Place order'}
              </button>
            )}
          </div>
        </form>

        {cart.data?.lines.length ? <OrderSummary cart={cart.data} /> : null}
      </div>
    </div>
  );
}
