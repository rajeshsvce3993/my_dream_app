import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';

type Props = {
  title: { en: string; ta?: string };
  subtitle?: { en: string; ta?: string };
  href?: string;
  linkLabel?: { en: string; ta?: string };
};

export function SectionHeader({ title, subtitle, href, linkLabel }: Props) {
  const { tName } = useLocale();
  return (
    <header className="qc-section-header">
      <div>
        <h2>{tName(title)}</h2>
        {subtitle ? <p>{tName(subtitle)}</p> : null}
      </div>
      {href ? (
        <Link to={href} className="qc-section-header__link">
          {linkLabel ? tName(linkLabel) : 'View all'} <ChevronRight size={16} />
        </Link>
      ) : null}
    </header>
  );
}
