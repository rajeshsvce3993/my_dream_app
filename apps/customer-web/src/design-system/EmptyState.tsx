import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

type Props = {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionTo?: string;
  onAction?: () => void;
};

export function EmptyState({ icon: Icon, title, description, actionLabel, actionTo, onAction }: Props) {
  return (
    <div className="qc-empty" role="status">
      <div className="qc-empty__icon">
        <Icon size={32} strokeWidth={1.75} aria-hidden />
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      {actionTo ? (
        <Link to={actionTo} className="qc-btn qc-btn--primary">
          {actionLabel}
        </Link>
      ) : null}
      {onAction && actionLabel ? (
        <button type="button" className="qc-btn qc-btn--primary" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
