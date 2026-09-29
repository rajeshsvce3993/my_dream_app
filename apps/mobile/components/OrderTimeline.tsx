import { Text, View } from 'react-native';
import { theme } from '../lib/theme';

const FLOW = [
  'PENDING_PAYMENT',
  'PAID',
  'CONFIRMED',
  'PROCESSING',
  'PACKED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
] as const;

const LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Order placed',
  PAID: 'Payment confirmed',
  CONFIRMED: 'Vendor confirmed',
  PROCESSING: 'Preparing',
  PACKED: 'Packed',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
};

type Props = {
  current: string;
  timeline: Array<{ status: string; at: string }>;
};

export function OrderTimeline({ current, timeline }: Props) {
  const currentIdx = FLOW.indexOf(current as (typeof FLOW)[number]);

  return (
    <View style={{ gap: 0 }}>
      {FLOW.map((status, idx) => {
        const done = idx <= currentIdx;
        const isCurrent = status === current;
        const entry = timeline.find((t) => t.status === status);
        return (
          <View key={status} style={{ flexDirection: 'row', gap: 12, paddingVertical: 10 }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: done ? theme.primary : theme.border,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 2,
              }}
            >
              {done ? <Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>✓</Text> : null}
            </View>
            <View style={{ flex: 1, opacity: done || isCurrent ? 1 : 0.45 }}>
              <Text style={{ fontWeight: isCurrent ? '700' : '600', color: theme.secondary }}>
                {LABELS[status] ?? status}
              </Text>
              {entry ? (
                <Text style={{ color: theme.muted, fontSize: 12, marginTop: 2 }}>
                  {new Date(entry.at).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
