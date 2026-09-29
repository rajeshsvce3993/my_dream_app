import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Leaf, ArrowLeft } from 'lucide-react';
import { apiRequest, setTokens } from '../api/client';
import { afterAuthNavigate } from '../lib/authReturn';

type Step = 'phone' | 'otp';

function formatPhoneDisplay(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 10);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)} ${d.slice(5)}`;
}

function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = params.get('returnTo');

  const [step, setStep] = useState<Step>('phone');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [normalizedPhone, setNormalizedPhone] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpLength, setOtpLength] = useState(4);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [expiresIn, setExpiresIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0 && expiresIn <= 0) return;
    const t = window.setInterval(() => {
      setResendIn((s) => (s <= 1 ? 0 : s - 1));
      setExpiresIn((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [resendIn, expiresIn]);

  const digits = phoneDigits.replace(/\D/g, '');

  const sendOtp = useCallback(async () => {
    setMessage(null);
    setPhoneError(null);
    if (digits.length !== 10) {
      setPhoneError('Enter a valid 10-digit mobile number.');
      return;
    }
    if (loading) return;
    setLoading(true);
    try {
      const data = await apiRequest<{
        phone: string;
        maskedPhone: string;
        resendInSeconds: number;
        expirySeconds: number;
        otpLength: number;
      }>('/auth/otp/request', {
        method: 'POST',
        body: JSON.stringify({ phone: digits }),
      });
      setNormalizedPhone(data.phone);
      setMaskedPhone(data.maskedPhone);
      setResendIn(data.resendInSeconds);
      setExpiresIn(data.expirySeconds);
      setOtpLength(data.otpLength);
      setStep('otp');
      setOtp('');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not send OTP.');
    } finally {
      setLoading(false);
    }
  }, [digits, loading]);

  async function verifyOtp() {
    setMessage(null);
    if (expiresIn <= 0) {
      setMessage('OTP expired. Request a new code.');
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<{
        tokens: { accessToken: string; refreshToken: string };
        needsAddress: boolean;
      }>('/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ phone: normalizedPhone, otp: otp.trim() }),
      });
      setTokens(data.tokens.accessToken, data.tokens.refreshToken);
      afterAuthNavigate(navigate, data.needsAddress, returnTo);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Verification failed';
      setMessage(msg.toLowerCase().includes('invalid') ? 'Incorrect OTP. Try again.' : msg);
    } finally {
      setLoading(false);
    }
  }

  const autoVerify = useRef('');
  useEffect(() => {
    if (step !== 'otp' || otp.length !== otpLength || loading || expiresIn <= 0) return;
    if (autoVerify.current === otp) return;
    autoVerify.current = otp;
    void verifyOtp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp, otpLength, step, expiresIn]);

  return (
    <div className="qc-auth">
      <div className="qc-auth-card">
        {step === 'otp' ? (
          <button type="button" className="qc-auth-back" onClick={() => setStep('phone')} aria-label="Back">
            <ArrowLeft size={20} />
          </button>
        ) : (
          <Link to="/" className="qc-auth-back" aria-label="Close">
            ×
          </Link>
        )}

        <div className="qc-auth-logo" aria-hidden>
          <Leaf size={28} />
        </div>

        {step === 'phone' ? (
          <>
            <h1 className="qc-auth-title">Welcome back 👋</h1>
            <p className="qc-auth-sub">Sign in to continue shopping with us.</p>
            <label className="qc-auth-label" htmlFor="phone">
              Mobile number
            </label>
            <div className={`qc-auth-phone ${phoneError ? 'qc-auth-phone--error' : ''}`}>
              <span>🇮🇳 +91</span>
              <input
                id="phone"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="98765 43210"
                value={formatPhoneDisplay(phoneDigits)}
                onChange={(e) => {
                  setPhoneDigits(e.target.value.replace(/\D/g, '').slice(0, 10));
                  setPhoneError(null);
                }}
              />
            </div>
            {phoneError ? <p className="qc-auth-error">{phoneError}</p> : null}
            <button type="button" className="qc-btn qc-btn--primary qc-btn--block" disabled={digits.length !== 10 || loading} onClick={sendOtp}>
              {loading ? 'Sending…' : 'Continue'}
            </button>
          </>
        ) : (
          <>
            <h1 className="qc-auth-title">Verify your number</h1>
            <p className="qc-auth-sub">
              We sent a verification code to <strong>{maskedPhone || normalizedPhone}</strong>
            </p>
            <div className="qc-auth-otp" role="group" aria-label="One-time password">
              {Array.from({ length: otpLength }).map((_, i) => (
                <input
                  key={i}
                  inputMode="numeric"
                  autoComplete={i === 0 ? 'one-time-code' : 'off'}
                  maxLength={1}
                  value={otp[i] ?? ''}
                  aria-label={`Digit ${i + 1}`}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '');
                    const arr = otp.split('');
                    arr[i] = v;
                    const next = arr.join('').slice(0, otpLength);
                    setOtp(next);
                    if (v && i < otpLength - 1) {
                      (e.target.nextElementSibling as HTMLInputElement | null)?.focus();
                    }
                  }}
                />
              ))}
            </div>
            <p className="qc-auth-meta">{expiresIn > 0 ? `OTP expires in ${formatCountdown(expiresIn)}` : 'OTP expired'}</p>
            <p className="qc-auth-meta">Didn&apos;t receive it?</p>
            <button type="button" className="qc-auth-link" disabled={resendIn > 0 || loading} onClick={sendOtp}>
              {resendIn > 0 ? `Resend OTP in ${resendIn}s` : 'Resend OTP'}
            </button>
            <button
              type="button"
              className="qc-btn qc-btn--primary qc-btn--block"
              disabled={otp.length !== otpLength || loading || expiresIn <= 0}
              onClick={verifyOtp}
            >
              {loading ? 'Verifying…' : 'Verify OTP'}
            </button>
            <button type="button" className="qc-auth-link" onClick={() => setStep('phone')}>
              Change mobile number
            </button>
          </>
        )}

        {message ? <p className="qc-auth-error qc-auth-error--center">{message}</p> : null}
        <p className="qc-auth-legal">By continuing, you agree to our Terms & Privacy Policy.</p>
      </div>
    </div>
  );
}
