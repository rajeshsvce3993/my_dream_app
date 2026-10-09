import { StyleSheet, Text, View } from 'react-native';
import { orderSerial, queueStatusLabel, queueStatusTone } from '../lib/orderActions';
import { theme } from '../lib/theme';

function shortWhen(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === new Date().toDateString()) return time;
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} ${time}`;
}

const toneStyle = {
  new: { bg: theme.warningSoft, text: '#8A5A16' },
  active: { bg: '#E4F1F4', text: '#1A5563' },
  done: { bg: theme.successSoft, text: theme.success },
  cancel: { bg: theme.dangerSoft, text: theme.danger },
} as const;

export function OrderTicketHeader({
  orderNumber,
  status,
  createdAt,
}: {
  orderNumber: string;
  status: string;
  createdAt?: string;
}) {
  const tone = toneStyle[queueStatusTone(status)];
  return (
    <View style={styles.row}>
      <View style={styles.side}>
        <Text style={styles.no} numberOfLines={1}>
          {orderSerial(orderNumber)}
        </Text>
      </View>
      <View style={[styles.pill, { backgroundColor: tone.bg }]}>
        <Text style={[styles.pillText, { color: tone.text }]} numberOfLines={1}>
          {queueStatusLabel(status)}
        </Text>
      </View>
      <View style={styles.sideEnd}>
        <Text style={styles.time} numberOfLines={1}>
          {shortWhen(createdAt)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F7F4EF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  side: { flex: 1 },
  sideEnd: { flex: 1, alignItems: 'flex-end' },
  no: { fontSize: 14, fontWeight: '800', color: '#1A5563', letterSpacing: 0.2 },
  pill: {
    maxWidth: 120,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
  },
  pillText: { fontSize: 10, fontWeight: '700' },
  time: { fontSize: 11, fontWeight: '600', color: theme.muted },
});
