import { Link, useNavigate } from 'react-router-dom';
import { Package, MapPin, LogIn, Heart, Settings, LogOut } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useLocationContext } from '../context/LocationContext';
import { apiRequest, clearTokens } from '../api/client';
import { loginPath } from '../lib/authReturn';

type Me = { firstName: string; phone?: string; phoneVerified?: boolean };

export function ProfilePage() {
  const { location } = useLocationContext();
  const navigate = useNavigate();
  const signedIn = Boolean(localStorage.getItem('accessToken'));

  const me = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => apiRequest<Me>('/auth/me'),
    enabled: signedIn,
    retry: false,
  });

  const menu = [
    { to: '/orders', icon: Package, label: 'My Orders' },
    { to: '/delivery-address', icon: MapPin, label: 'My Addresses' },
    { to: '/profile', icon: Heart, label: 'Wishlist' },
    { to: '/profile', icon: Settings, label: 'Account Settings' },
  ];

  return (
    <div className="qc-profile">
      <h1>Profile</h1>
      {signedIn ? (
        <div className="qc-profile-card">
          <div className="qc-profile-avatar">{me.data?.firstName?.[0] ?? 'C'}</div>
          <div>
            <strong>{me.data?.firstName ?? 'Customer'}</strong>
            <p className="qc-meta">{me.data?.phone ?? 'Phone verified'}</p>
          </div>
        </div>
      ) : (
        <Link to={loginPath('/profile')} className="qc-btn qc-btn--primary qc-btn--block">
          <LogIn size={18} /> Sign in
        </Link>
      )}

      <div className="qc-profile-card">
        <MapPin size={20} aria-hidden />
        <div>
          <span className="qc-caption">Delivering to</span>
          <strong>{location.label}</strong>
          <p className="qc-meta">{location.line1 ?? location.city}</p>
        </div>
      </div>

      {signedIn ? (
        <nav className="qc-profile-menu">
          {menu.map((item) => (
            <Link key={item.label} to={item.to} className="qc-profile-link">
              <item.icon size={20} /> {item.label}
            </Link>
          ))}
          <button
            type="button"
            className="qc-btn qc-btn--outline qc-btn--block"
            onClick={async () => {
              try {
                await apiRequest('/auth/logout', { method: 'POST' });
              } catch {
                /* ignore */
              }
              clearTokens();
              navigate('/');
            }}
          >
            <LogOut size={18} /> Log out
          </button>
        </nav>
      ) : null}
    </div>
  );
}
