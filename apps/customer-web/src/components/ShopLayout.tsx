import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Home, UtensilsCrossed, Search, ShoppingBag, User, MapPin, Tag } from 'lucide-react';
import { useBrand } from '../hooks/useBrand';
import { useLocale } from '../context/LocaleContext';
import { cartItemCount, useCart } from '../hooks/useCart';
import { useLocationContext } from '../context/LocationContext';

export function ShopLayout() {
  const { name } = useBrand();
  const { locale, setLocale, supportedLanguages } = useLocale();
  const navigate = useNavigate();
  const cart = useCart();
  const count = cartItemCount(cart.data);
  const { location } = useLocationContext();

  return (
    <div className="qc-app">
      <header className="qc-header">
        <NavLink to="/" className="qc-brand">
          <span className="qc-brand__mark" aria-hidden />
          <span>{name}</span>
        </NavLink>

        <button
          type="button"
          className="qc-location-btn"
          onClick={() => navigate('/delivery-address')}
          aria-label="Delivery location"
        >
          <MapPin size={16} aria-hidden />
          <span>
            <span className="qc-caption">Delivering to</span>
            <strong>{location.label}</strong>
          </span>
        </button>

        <form
          className="qc-search-bar qc-search-bar--header"
          onSubmit={(e) => {
            e.preventDefault();
            const q = new FormData(e.currentTarget).get('q') as string;
            navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
          }}
        >
          <Search size={18} aria-hidden />
          <input name="q" placeholder="Search dishes, restaurants…" aria-label="Search" />
        </form>

        <nav className="qc-header-actions" aria-label="Account">
          <NavLink to="/offers" className="qc-icon-btn" aria-label="Offers">
            <Tag size={20} />
          </NavLink>
          <NavLink to="/cart" className="qc-icon-btn qc-cart-btn" aria-label="Cart">
            <ShoppingBag size={20} />
            {count > 0 ? <span className="qc-cart-count">{count}</span> : null}
          </NavLink>
          <select
            className="qc-lang"
            aria-label="Language"
            value={locale}
            onChange={(e) => setLocale(e.target.value as 'en' | 'ta')}
          >
            {supportedLanguages.map((lang) => (
              <option key={lang} value={lang}>
                {lang === 'en' ? 'EN' : 'TA'}
              </option>
            ))}
          </select>
        </nav>
      </header>

      <main className="qc-main">
        <Outlet />
      </main>

      <nav className="qc-bottom-nav" aria-label="Primary">
        <NavLink to="/" end>
          <Home size={22} />
          <span>Home</span>
        </NavLink>
        <NavLink to="/restaurants">
          <UtensilsCrossed size={22} />
          <span>Restaurants</span>
        </NavLink>
        <NavLink to="/offers">
          <Tag size={22} />
          <span>Offers</span>
        </NavLink>
        <NavLink to="/cart">
          <ShoppingBag size={22} />
          <span>Cart</span>
          {count > 0 ? <em className="qc-bottom-badge">{count}</em> : null}
        </NavLink>
        <NavLink to="/profile">
          <User size={22} />
          <span>Account</span>
        </NavLink>
      </nav>
    </div>
  );
}
