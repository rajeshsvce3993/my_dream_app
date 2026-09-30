import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Tag } from 'lucide-react';
import { apiRequest } from '../api/client';
import { useLocale } from '../context/LocaleContext';

type PromoSlide = {
  label: { en: string; ta?: string };
  subtitle?: { en: string; ta?: string };
  ctaLabel?: { en: string; ta?: string };
  ctaPath?: string;
  imageUrl?: string;
};

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=400&h=320&q=80',
  'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=400&h=320&q=80',
  'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=400&h=320&q=80',
];

const DEFAULT_OFFERS: PromoSlide[] = [
  {
    label: { en: 'Flat 50% OFF on your first order', ta: 'முதல் ஆர்டரில் Flat 50% OFF' },
    subtitle: { en: 'New users · save up to ₹100', ta: 'புதிய பயனர்கள் · ₹100 வரை சேமிப்பு' },
    ctaLabel: { en: 'Grab it', ta: 'எடுங்கள்' },
    ctaPath: '/restaurants',
    imageUrl: FALLBACK_IMAGES[0],
  },
  {
    label: { en: 'Flat ₹100 OFF on orders above ₹200', ta: '₹200-க்கு மேல் Flat ₹100 OFF' },
    subtitle: { en: 'No code needed · auto applied', ta: 'கோட் தேவையில்லை' },
    ctaLabel: { en: 'Order now', ta: 'ஆர்டர்' },
    ctaPath: '/restaurants',
    imageUrl: FALLBACK_IMAGES[1],
  },
  {
    label: { en: 'Free delivery on select kitchens', ta: 'தேர்ந்த உணவகங்களில் இலவச டெலிவரி' },
    subtitle: { en: 'Limited slots near you', ta: 'அருகில் வரையறுக்கப்பட்ட slot' },
    ctaLabel: { en: 'Browse', ta: 'பார்க்க' },
    ctaPath: '/restaurants',
    imageUrl: FALLBACK_IMAGES[2],
  },
];

export function OffersPage() {
  const { tName } = useLocale();

  const offers = useQuery({
    queryKey: ['web-offers'],
    queryFn: async () => {
      const config = await apiRequest<Record<string, unknown>>('/configuration/public');
      const fromConfig =
        (config['mobile.home.promos'] as PromoSlide[] | undefined) ??
        (config['mobile.offers'] as PromoSlide[] | undefined);
      const list = (fromConfig ?? []).filter((p) => p?.label);
      return list.length ? list : DEFAULT_OFFERS;
    },
  });

  return (
    <div className="qc-offers-page">
      <header className="qc-page-header">
        <h1>
          <Tag size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />
          Offers
        </h1>
        <p className="qc-caption">Same deals as the mobile app — tap to start ordering.</p>
      </header>

      <div className="qc-offers-list">
        {(offers.data ?? []).map((offer, index) => {
          const href = offer.ctaPath?.startsWith('/') ? offer.ctaPath : '/restaurants';
          const img = offer.imageUrl?.trim() || FALLBACK_IMAGES[index % FALLBACK_IMAGES.length]!;
          return (
            <Link key={index} to={href} className="qc-offer-card">
              <img src={img} alt="" loading="lazy" />
              <div>
                <strong>{tName(offer.label)}</strong>
                {offer.subtitle ? <p className="qc-caption">{tName(offer.subtitle)}</p> : null}
                {offer.ctaLabel ? (
                  <span className="qc-offer-cta">{tName(offer.ctaLabel)} ›</span>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
