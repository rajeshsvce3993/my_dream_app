import { Check } from 'lucide-react';

export const ORDER_FLOW = [
  'PENDING_PAYMENT',
  'PAID',
  'CONFIRMED',
  'PROCESSING',
  'PACKED',
  'READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
] as const;

export const ORDER_STATUS_LABEL: Record<string, { en: string; ta?: string }> = {
  OUT_FOR_DELIVERY: { en: 'Out for delivery', ta: 'விநியோகத்தில்' },
  PENDING_PAYMENT: { en: 'Order placed', ta: 'ஆர்டர் செய்யப்பட்டது' },
  PAID: { en: 'Payment confirmed', ta: 'பணம் உறுதி' },
  CONFIRMED: { en: 'Vendor confirmed', ta: 'விற்பனையாளர் உறுதி' },
  PROCESSING: { en: 'Preparing', ta: 'தயாராகிறது' },
  PACKED: { en: 'Packed', ta: 'பேக் செய்யப்பட்டது' },
  READY_FOR_PICKUP: { en: 'Ready for pickup', ta: 'பிக்கப்புக்கு தயார்' },
  DELIVERED: { en: 'Delivered', ta: 'வழங்கப்பட்டது' },
};

type Props = {
  current: string;
  timeline: Array<{ status: string; at: string }>;
  labelFor: (status: string) => string;
};

export function OrderTimeline({ current, timeline, labelFor }: Props) {
  const currentIdx = ORDER_FLOW.indexOf(current as (typeof ORDER_FLOW)[number]);
  const finished = current === 'DELIVERED';

  return (
    <ol className="qc-track-timeline">
      {ORDER_FLOW.map((status, idx) => {
        const entry = timeline.find((t) => t.status === status);
        const done = idx < currentIdx || (finished && idx === currentIdx) || Boolean(entry);
        const isCurrent = status === current && !finished;
        return (
          <li key={status} className={isCurrent ? 'is-current' : done ? 'is-done' : 'is-pending'}>
            <span className="qc-track-dot" aria-hidden>
              {done ? <Check size={14} strokeWidth={3} /> : null}
            </span>
            <div>
              <strong>{labelFor(status)}</strong>
              {entry ? (
                <time className="qc-meta" dateTime={entry.at}>
                  {new Date(entry.at).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </time>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
