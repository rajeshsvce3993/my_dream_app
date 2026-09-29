import { NavLink, Outlet } from 'react-router-dom';
import { clearTokens } from '../api/client';

const links = [
  ['Dashboard', '/dashboard'],
  ['Products', '/products'],
  ['Categories', '/categories'],
  ['Vendors', '/vendors'],
  ['Vendor mapping', '/vendor-mapping'],
  ['Pricing', '/pricing'],
  ['Offers', '/offers'],
  ['Coupons', '/coupons'],
  ['Inventory', '/inventory'],
  ['Orders', '/orders'],
  ['Customers', '/customers'],
  ['Payments', '/payments'],
  ['Delivery', '/delivery'],
  ['Delivery partners', '/delivery-partners'],
  ['Vendor app accounts', '/vendor-partners'],
  ['Notifications', '/notifications'],
  ['Reports', '/reports'],
  ['Roles & Permissions', '/roles'],
  ['Audit Logs', '/audit-logs'],
  ['Settings', '/settings'],
  ['Configuration', '/configuration'],
] as const;

export function AdminLayout() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>🌿</span>
          <strong>FreshMart</strong>
        </div>
        <nav>
          {links.map(([label, path]) => (
            <NavLink key={path} to={path} className={({ isActive }) => (isActive ? 'active' : undefined)}>
              {label}
            </NavLink>
          ))}
        </nav>
        <button
          style={{ marginTop: '2rem', width: '100%', background: '#334155' }}
          onClick={() => {
            clearTokens();
            window.location.href = '/login';
          }}
        >
          Sign out
        </button>
      </aside>
      <main className="content">
        <header className="admin-topbar">
          <input className="admin-search" placeholder="Search admin…" aria-label="Search" />
          <div className="admin-profile">
            <span className="admin-avatar">A</span>
            Admin ▾
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
