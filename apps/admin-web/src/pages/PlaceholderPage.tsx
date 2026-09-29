import { useLocation } from 'react-router-dom';

export function PlaceholderPage() {
  const { pathname } = useLocation();
  const title = pathname.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') ?? 'Module';

  return (
    <div className="panel">
      <h1 style={{ textTransform: 'capitalize', marginTop: 0 }}>{title}</h1>
      <p style={{ color: 'var(--fm-muted)' }}>
        This admin module matches the FreshMart wireframe navigation. Core catalog, orders, and configuration are
        live; extended operations for this section can be wired to backend APIs as needed.
      </p>
    </div>
  );
}
