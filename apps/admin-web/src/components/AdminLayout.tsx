import { useQuery } from '@tanstack/react-query';
import { NavLink, Outlet } from 'react-router-dom';
import { apiRequest, clearTokens } from '../api/client';

type Me = {
  firstName?: string;
  lastName?: string;
  email?: string;
  displayName?: string;
  roles?: string[];
};

const NAV_GROUPS = [
  {
    label: 'Ops',
    links: [
      ['Dashboard', '/dashboard'],
      ['Payments', '/payments'],
      ['Orders', '/orders'],
      ['Launch areas', '/delivery'],
      ['Delivery charges', '/delivery-charges'],
      ['Partner earnings', '/partner-earnings'],
      ['Delivery partners', '/delivery-partners'],
    ],
  },
  {
    label: 'Catalog',
    links: [
      ['Products', '/products'],
      ['Categories', '/categories'],
      ['Vendors', '/vendors'],
      ['Vendor mapping', '/vendor-mapping'],
    ],
  },
  {
    label: 'People',
    links: [
      ['Customers', '/customers'],
      ['Vendor accounts', '/vendor-partners'],
    ],
  },
  {
    label: 'Experience',
    links: [
      ['Home verticals', '/home-verticals'],
      ['Top picks', '/home-top-picks'],
      ['Configuration', '/configuration'],
    ],
  },
] as const;

export function AdminLayout() {
  const me = useQuery({
    queryKey: ['admin-me'],
    queryFn: () => apiRequest<Me>('/auth/me'),
    staleTime: 60_000,
    retry: false,
  });

  const name =
    me.data?.displayName?.trim() ||
    [me.data?.firstName, me.data?.lastName].filter(Boolean).join(' ') ||
    'Admin';
  const initial = (name.trim()[0] ?? 'A').toUpperCase();
  const role = me.data?.roles?.[0]?.replaceAll('_', ' ') ?? 'Administrator';

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-mark">DF</div>
          <div>
            <strong>Dream Food</strong>
            <small>Admin control</small>
          </div>
        </div>

        <div className="sidebar-nav">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="nav-group-label">{group.label}</div>
              <div className="nav-group">
                {group.links.map(([label, path]) => (
                  <NavLink
                    key={path}
                    to={path}
                    className={({ isActive }) => (isActive ? 'active' : undefined)}
                  >
                    {label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="sidebar-signout"
          onClick={() => {
            clearTokens();
            window.location.href = '/login';
          }}
        >
          Sign out
        </button>
      </aside>

      <div className="content">
        <header className="admin-topbar">
          <div>
            <div className="admin-topbar-title">Marketplace control plane</div>
            <div className="admin-topbar-sub">Customer · Vendor · Delivery</div>
          </div>
          <div className="admin-profile">
            <div style={{ textAlign: 'right' }}>
              <div>{name}</div>
              <div className="admin-topbar-sub">{role}</div>
            </div>
            <span className="admin-avatar">{initial}</span>
          </div>
        </header>
        <main className="admin-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
