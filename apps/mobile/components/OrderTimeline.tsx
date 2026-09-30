import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme, spacing } from '../lib/theme';

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
  CONFIRMED: 'Restaurant confirmed',
  PROCESSING: 'Preparing',
  PACKED: 'Ready for pickup',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
};

type Props = {
  current: string;
  timeline: Array<{ status: string; at: string }>;
};

export function OrderTimeline({ current, timeline }: Props) {
  const currentIdx = Math.max(0, FLOW.indexOf(current as (typeof FLOW)[number]));

  return (
    <View>
      {FLOW.map((status, idx) => {
        const done = idx <= currentIdx;
        const isCurrent = idx === currentIdx;
        const isLast = idx === FLOW.length - 1;
        const entry = timeline.find((t) => t.status === status);
        const lineDone = idx < currentIdx;

        return (
          <View key={status} style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ width: 22, alignItems: 'center' }}>
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  borderWidth: isCurrent ? 2 : 0,
                  borderColor: theme.bannerBg,
                  backgroundColor: done
                    ? isCurrent
                      ? theme.white
                      : theme.bannerBg
                    : theme.neutralSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {done && !isCurrent ? (
                  <Ionicons name="checkmark" size={12} color={theme.white} />
                ) : (
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: isCurrent ? theme.bannerBg : done ? theme.bannerBg : theme.border,
                    }}
                  />
                )}
              </View>
              {!isLast ? (
                <View
                  style={{
                    width: 2,
                    flex: 1,
                    minHeight: 28,
                    backgroundColor: lineDone ? theme.bannerBg : theme.border,
                    marginVertical: 2,
                  }}
                />
              ) : null}
            </View>

            <View style={{ flex: 1, paddingBottom: isLast ? 0 : spacing.md, paddingTop: 1 }}>
              <Text
                style={{
                  fontWeight: isCurrent ? '800' : '600',
                  fontSize: 13,
                  color: done || isCurrent ? theme.text : theme.muted,
                }}
              >
                {LABELS[status] ?? status.replaceAll('_', ' ')}
              </Text>
              {entry ? (
                <Text style={{ color: theme.muted, fontSize: 11, marginTop: 2 }}>
                  {new Date(entry.at).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Text>
              ) : isCurrent ? (
                <Text style={{ color: theme.bannerBg, fontSize: 11, fontWeight: '600', marginTop: 2 }}>
                  In progress
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
