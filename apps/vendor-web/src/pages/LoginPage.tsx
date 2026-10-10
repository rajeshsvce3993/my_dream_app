import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest, apiRequestWithToken, clearTokens, setTokens } from '../api/client';

const EMAIL_CACHE_KEY = 'vendorLoginEmail';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(EMAIL_CACHE_KEY);
    if (saved) setEmail(saved);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      clearTokens();
      const data = await apiRequest<{ tokens: { accessToken: string; refreshToken: string } }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      });
      await apiRequestWithToken('/vendor/me', data.tokens.accessToken);
      setTokens(data.tokens.accessToken, data.tokens.refreshToken);
      if (rememberEmail) localStorage.setItem(EMAIL_CACHE_KEY, email.trim());
      else localStorage.removeItem(EMAIL_CACHE_KEY);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-backdrop" aria-hidden>
        <div className="login-orb login-orb-a" />
        <div className="login-orb login-orb-b" />
      </div>

      <div className="login-layout">
        <section className="login-aside">
          <div className="login-aside-brand">
            <div className="login-mark">DV</div>
            <div>
              <p className="login-kicker">Restaurant portal</p>
              <h1>Dream Vendor</h1>
            </div>
          </div>

          <p className="login-aside-lead">
            Run your kitchen from the counter or the browser. Same shop login as the vendor mobile app.
          </p>

          <ul className="login-aside-points">
            <li>
              <strong>New orders</strong>
              <span>Accept, prepare, pack, and mark ready for pickup.</span>
            </li>
            <li>
              <strong>Menu control</strong>
              <span>Update prices and hide dishes when they are sold out.</span>
            </li>
            <li>
              <strong>Shop earnings</strong>
              <span>Track today’s sales and payouts after the service charge.</span>
            </li>
            <li>
              <strong>Open or close</strong>
              <span>Pause new orders when the kitchen is busy or closed.</span>
            </li>
          </ul>
        </section>

        <div className="login-modal" role="dialog" aria-modal="true" aria-labelledby="vendor-login-title">
          <div className="login-ticket">
            <div className="login-ticket-body">
              <h2 id="vendor-login-title">Shop sign in</h2>
              <p className="login-lead">Use the login your admin created for this restaurant.</p>

              <form className="login-form" onSubmit={onSubmit}>
                <label>
                  Email
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    required
                    autoComplete="username"
                    placeholder="shop@example.com"
                  />
                </label>
                <label>
                  Password
                  <div className="login-password">
                    <input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      placeholder="Password"
                    />
                    <button type="button" className="login-eye" onClick={() => setShowPassword((value) => !value)}>
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </label>

                <label className="login-remember">
                  <input
                    type="checkbox"
                    checked={rememberEmail}
                    onChange={(e) => setRememberEmail(e.target.checked)}
                  />
                  <span>Remember email on this device</span>
                </label>

                {error ? <p className="login-error">{error}</p> : null}

                <button className="login-cta" type="submit" disabled={loading}>
                  {loading ? 'Signing in…' : 'Open shop'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
