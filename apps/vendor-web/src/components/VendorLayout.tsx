import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest, clearTokens } from '../api/client';

type Me = {
  vendor: { name: string } | null;
};

const links = [
  ['Home', '/'],
  ['Orders', '/orders'],
  ['Products', '/products'],
  ['Earnings', '/earnings'],
  ['Profile', '/profile'],
] as const;

export function VendorLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const me = useQuery({
    queryKey: ['vendor-me'],
    queryFn: () => apiRequest<Me>('/vendor/me'),
    refetchInterval: 15000,
  });

  const shopName = me.data?.vendor?.name ?? 'Kitchen portal';

  return (
    <div className="vendor-shell">
      <aside className="vendor-sidebar">
        <div className="vendor-brand">
          <div className="vendor-mark">DV</div>
          <div>
            <strong>Dream Vendor</strong>
            <small>{shopName}</small>
          </div>
        </div>

        <nav className="vendor-nav">
          {links.map(([label, to]) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : undefined)}>
              {label}
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          className="vendor-signout"
          onClick={() => {
            clearTokens();
            qc.clear();
            navigate('/login', { replace: true });
          }}
        >
          Sign out
        </button>
      </aside>

      <main className="vendor-main">
        <Outlet />
      </main>
    </div>
  );
}
