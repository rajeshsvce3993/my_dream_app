import { Link } from 'react-router-dom';
import {
  Gift,
  Shirt,
  ShoppingBasket,
  Smartphone,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import { useLocale } from '../context/LocaleContext';

export type HomeVertical = {
  id: string;
  label: { en: string; ta?: string };
  subtitle?: { en: string; ta?: string };
  icon: string;
  webIcon?: string;
  isPrimary?: boolean;
  status: 'live' | 'coming_soon';
  resolvedHref: string;
};

const WEB_ICONS: Record<string, LucideIcon> = {
  utensils: UtensilsCrossed,
  'shopping-basket': ShoppingBasket,
  smartphone: Smartphone,
  shirt: Shirt,
  gift: Gift,
};

type Props = {
  verticals: HomeVertical[];
  title?: { en: string; ta?: string };
};

export function HomeVerticalsSection({ verticals, title }: Props) {
  const { tName } = useLocale();
  if (!verticals.length) return null;

  const primary = verticals.find((v) => v.isPrimary) ?? verticals[0];
  const others = verticals.filter((v) => v.id !== primary?.id);

  function iconFor(v: HomeVertical) {
    const key = v.webIcon ?? v.icon;
    return WEB_ICONS[key] ?? UtensilsCrossed;
  }

  function onSoonClick(e: React.MouseEvent) {
    e.preventDefault();
    window.alert('Coming soon — food delivery is live now!');
  }

  return (
    <section className="qc-section qc-verticals">
      {title ? <h2 className="qc-verticals__title">{tName(title)}</h2> : null}

      {primary ? (
        <PrimaryTile vertical={primary} Icon={iconFor(primary)} label={tName(primary.label)} subtitle={primary.subtitle ? tName(primary.subtitle) : undefined} />
      ) : null}

      {others.length ? (
        <div className="qc-verticals__row">
          {others.map((v) => {
            const Icon = iconFor(v);
            const soon = v.status === 'coming_soon';
            const inner = (
              <>
                <span className="qc-vertical-tile__icon" aria-hidden>
                  <Icon size={22} />
                </span>
                <span className="qc-vertical-tile__label">{tName(v.label)}</span>
                {soon ? <span className="qc-vertical-tile__badge">Soon</span> : null}
              </>
            );
            if (soon) {
              return (
                <button key={v.id} type="button" className="qc-vertical-tile qc-vertical-tile--soon" onClick={onSoonClick}>
                  {inner}
                </button>
              );
            }
            return (
              <Link key={v.id} to={v.resolvedHref} className="qc-vertical-tile">
                {inner}
              </Link>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function PrimaryTile({
  vertical,
  Icon,
  label,
  subtitle,
}: {
  vertical: HomeVertical;
  Icon: LucideIcon;
  label: string;
  subtitle?: string;
}) {
  const soon = vertical.status === 'coming_soon';
  const content = (
    <>
      <span className="qc-vertical-primary__icon" aria-hidden>
        <Icon size={28} />
      </span>
      <span className="qc-vertical-primary__text">
        <strong>{label}</strong>
        {subtitle ? <span>{subtitle}</span> : null}
      </span>
    </>
  );
  if (soon) {
    return (
      <button type="button" className="qc-vertical-primary" onClick={() => window.alert('Coming soon')}>
        {content}
      </button>
    );
  }
  return (
    <Link to={vertical.resolvedHref} className="qc-vertical-primary">
      {content}
    </Link>
  );
}
