import { StyleSheet, Text, View } from 'react-native';
import { money } from '../lib/format';

export function OrderMoney({ bill, earnings }: { bill: number; earnings: number }) {
  return (
    <View style={styles.row}>
      <View style={styles.pair}>
        <Text style={styles.label}>Earnings</Text>
        <Text style={styles.earn}>{money(earnings)}</Text>
      </View>
      <View style={styles.rule} />
      <View style={styles.pair}>
        <Text style={styles.label}>Sales</Text>
        <Text style={styles.sales}>{money(bill)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pair: { alignItems: 'flex-end' },
  label: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#8A7B70',
  },
  sales: { marginTop: 1, fontSize: 13, fontWeight: '800', color: '#1A5563' },
  earn: { marginTop: 1, fontSize: 13, fontWeight: '800', color: '#0F2430' },
  rule: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: '#DDD4C8', marginVertical: 1 },
});
