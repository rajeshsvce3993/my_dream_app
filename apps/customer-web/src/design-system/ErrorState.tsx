import { AlertCircle } from 'lucide-react';

type Props = {
  message?: string;
  onRetry?: () => void;
};

export function ErrorState({ message = 'Something went wrong. Please try again.', onRetry }: Props) {
  return (
    <div className="qc-error-state" role="alert">
      <AlertCircle size={28} aria-hidden />
      <p>{message}</p>
      {onRetry ? (
        <button type="button" className="qc-btn qc-btn--outline" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}
