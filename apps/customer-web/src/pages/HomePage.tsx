import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Clock, MapPin, Sparkles, Store, Truck } from 'lucide-react';
import { apiRequest } from '../api/client';
import { useLocale } from '../context/LocaleContext';
import { useLocationContext } from '../context/LocationContext';
import { ErrorState } from '../design-system/ErrorState';
import { HomeFeedSkeleton } from '../design-system/Skeleton';
import { ProductCard, type ProductSummary } from '../design-system/ProductCard';
import { SectionHeader } from '../design-system/SectionHeader';

type HomeFeed = {
  greeting: { en: string; ta?: string };
  deliveryPromise: { en: string; ta?: string };
  sections: Array<{
    id: string;
    type: string;
    title?: { en: string; ta?: string };
    data: unknown;
  }>;
};

export function HomePage() {
  const { tName } = useLocale();
  const { location, query } = useLocationContext();

  const feed = useQuery({
    queryKey: ['home-feed', query.lng, query.lat],
    queryFn: () => apiRequest<HomeFeed>(`/catalog/home?lng=${query.lng}&lat=${query.lat}`),
  });

  if (feed.isLoading) return <HomeFeedSkeleton />;
  if (feed.isError) return <ErrorState onRetry={() => feed.refetch()} />;

  const data = feed.data!;

  return (
    <div className="qc-home">
      <div className="qc-delivery-strip">
        <Truck size={18} aria-hidden />
        <span>{tName(data.deliveryPromise)}</span>
        <span className="qc-delivery-strip__dot" />
        <MapPin size={16} aria-hidden />
        <span className="qc-delivery-strip__loc">{location.label}</span>
      </div>

      <p className="qc-greeting">{tName(data.greeting)}</p>

      {data.sections.map((section) => {
        if (section.type === 'hero_banner') {
          const hero = section.data as {
            title: { en: string; ta?: string };
            subtitle: { en: string; ta?: string };
            ctaLabel: { en: string; ta?: string };
            ctaPath: string;
          };
          return (
            <section key={section.id} className="qc-hero">
              <div className="qc-hero__content">
                <Sparkles className="qc-hero__spark" size={22} aria-hidden />
                <h1>{tName(hero.title)}</h1>
                <p>{tName(hero.subtitle)}</p>
                <Link to={hero.ctaPath} className="qc-btn qc-btn--accent">
                  {tName(hero.ctaLabel)}
                </Link>
              </div>
              <div className="qc-hero__glow" aria-hidden />
            </section>
          );
        }

        if (section.type === 'category_shortcuts') {
          const categories = (section.data as { categories: Array<{ _id: string; name: { en: string; ta?: string } }> })
            .categories;
          return (
            <section key={section.id} className="qc-section">
              {section.title ? <SectionHeader title={section.title} href="/products" /> : null}
              <div className="qc-grid qc-grid--categories">
                {categories.map((c) => (
                  <Link key={c._id} to={`/products?categoryId=${c._id}`} className="qc-category-tile">
                    <span>{tName(c.name)}</span>
                  </Link>
                ))}
              </div>
            </section>
          );
        }

        if (section.type === 'product_row') {
          const products = (section.data as { products: ProductSummary[] }).products;
          return (
            <section key={section.id} className="qc-section">
              {section.title ? (
                <SectionHeader title={section.title} href="/products" linkLabel={{ en: 'View all', ta: 'அனைத்தும்' }} />
              ) : null}
              <div className="qc-grid qc-grid--products">
                {products.map((p) => (
                  <ProductCard key={p.productId} product={p} />
                ))}
              </div>
            </section>
          );
        }

        if (section.type === 'vendor_row') {
          const vendors = (
            section.data as {
              vendors: Array<{
                id: string;
                name: string;
                rating: number;
                distanceKm?: number;
              }>;
            }
          ).vendors;
          return (
            <section key={section.id} className="qc-section">
              {section.title ? <SectionHeader title={section.title} /> : null}
              <div className="qc-vendor-row">
                {vendors.map((v) => (
                  <div key={v.id} className="qc-vendor-chip">
                    <Store size={18} aria-hidden />
                    <div>
                      <strong>{v.name}</strong>
                      <span className="qc-meta">
                        ★ {v.rating.toFixed(1)}
                        {v.distanceKm != null ? ` · ${v.distanceKm.toFixed(1)} km` : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        }

        if (section.type === 'value_props') {
          const props = (section.data as { props: Array<{ en: string; ta?: string }> }).props;
          return (
            <section key={section.id} className="qc-section qc-value-props">
              {section.title ? <SectionHeader title={section.title} /> : null}
              <ul>
                {props.map((line, i) => (
                  <li key={i}>
                    <Clock size={16} aria-hidden /> {tName(line)}
                  </li>
                ))}
              </ul>
            </section>
          );
        }

        if (section.type === 'promo_strip') {
          const promos = (section.data as { promos: Array<{ label: { en: string; ta?: string } }> }).promos;
          return (
            <section key={section.id} className="qc-promo-strip">
              {promos.map((p, i) => (
                <span key={i}>{tName(p.label)}</span>
              ))}
            </section>
          );
        }

        return null;
      })}
    </div>
  );
}
