import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api/client';

type Me = {
  approvalStatus: string;
  acceptingOrders: boolean;
  vendor: { name: string; code: string; status: string } | null;
  profile?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  } | null;
};

function statusLabel(value: string) {
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ProfilePage() {
  const me = useQuery({
    queryKey: ['vendor-me'],
    queryFn: () => apiRequest<Me>('/vendor/me'),
  });

  const data = me.data;
  const profile = data?.profile;
  const staffName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || 'Vendor staff';
  const shopOpen = Boolean(data?.acceptingOrders && data?.vendor?.status === 'ACTIVE');
  const initial = (profile?.firstName?.[0] ?? data?.vendor?.name?.[0] ?? 'V').toUpperCase();
  const approved = data?.approvalStatus === 'APPROVED';

  return (
    <div>
      <div className="vendor-page-head">
        <div>
          <h1>Profile</h1>
          <p>Shop identity and the staff account used for this portal.</p>
        </div>
      </div>

      {me.isLoading && !data ? <p className="muted">Loading profile…</p> : null}
      {me.isError && !data ? <p className="error">{(me.error as Error).message}</p> : null}

      {data ? (
        <div className="profile-page">
          <section className="profile-identity">
            <div className="profile-identity-main">
              <div className="profile-avatar">{initial}</div>
              <div className="profile-identity-text">
                <h2>{data.vendor?.name ?? 'Shop'}</h2>
                <p>{staffName}</p>
                {profile?.email ? <p className="profile-email">{profile.email}</p> : null}
              </div>
            </div>
            <div className="profile-identity-badges">
              <span className={`profile-badge ${shopOpen ? 'is-open' : 'is-closed'}`}>
                <span className="profile-badge-dot" aria-hidden />
                {shopOpen ? 'Accepting orders' : 'Not accepting orders'}
              </span>
              <span className={`profile-badge ${approved ? 'is-ok' : 'is-warn'}`}>
                {statusLabel(data.approvalStatus)}
              </span>
            </div>
          </section>

          <div className="profile-columns">
            <section className="vendor-panel profile-card">
              <header className="profile-card-head">
                <h3>Shop details</h3>
                <p>Restaurant record linked to this login.</p>
              </header>
              <ul className="profile-rows">
                <li>
                  <span>Shop name</span>
                  <strong>{data.vendor?.name ?? '—'}</strong>
                </li>
                <li>
                  <span>Shop code</span>
                  <strong className="profile-code">{data.vendor?.code ?? '—'}</strong>
                </li>
                <li>
                  <span>Shop status</span>
                  <strong>{data.vendor?.status ? statusLabel(data.vendor.status) : '—'}</strong>
                </li>
                <li>
                  <span>Order intake</span>
                  <strong>{shopOpen ? 'Open to customers' : 'Paused'}</strong>
                </li>
              </ul>
            </section>

            <section className="vendor-panel profile-card">
              <header className="profile-card-head">
                <h3>Staff account</h3>
                <p>Credentials used to sign in to Dream Vendor.</p>
              </header>
              <ul className="profile-rows">
                <li>
                  <span>Full name</span>
                  <strong>{staffName}</strong>
                </li>
                <li>
                  <span>Email</span>
                  <strong>{profile?.email?.trim() || '—'}</strong>
                </li>
                <li>
                  <span>Phone</span>
                  <strong>{profile?.phone?.trim() || 'Not set'}</strong>
                </li>
                <li>
                  <span>Role</span>
                  <strong>Vendor staff</strong>
                </li>
              </ul>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}
