import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { radius, theme } from '../lib/theme';

export const CANCEL_REASONS = [
  'Item unavailable',
  'Shop is too busy',
  'Closing for the day',
  'Customer requested',
] as const;

type Props = {
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  pending?: boolean;
};

export function CancelReasonForm({ value, onChange, onConfirm, onClose, pending }: Props) {
  const ready = value.trim().length > 0 && !pending;

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Cancel reason</Text>
      <View style={styles.chips}>
        {CANCEL_REASONS.map((reason) => {
          const selected = value === reason;
          return (
            <Pressable
              key={reason}
              onPress={() => onChange(reason)}
              style={[styles.chip, selected && styles.chipOn]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextOn]}>{reason}</Text>
            </Pressable>
          );
        })}
      </View>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Or type a reason"
        placeholderTextColor={theme.muted}
        maxLength={300}
        style={styles.input}
      />
      <View style={styles.actions}>
        <Pressable onPress={onClose} disabled={pending} style={styles.backBtn}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Pressable onPress={onConfirm} disabled={!ready} style={styles.confirmBtn}>
          <Text style={styles.confirmText} numberOfLines={1}>
            {pending ? 'Cancelling…' : 'Confirm cancel'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: 8,
    paddingBottom: 2,
  },
  title: { fontSize: 12, fontWeight: '800', color: theme.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    backgroundColor: theme.surface,
  },
  chipOn: { backgroundColor: theme.dangerSoft },
  chipText: { fontSize: 12, fontWeight: '700', color: theme.text },
  chipTextOn: { color: theme.danger },
  input: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: '600',
    color: theme.text,
    backgroundColor: theme.white,
  },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  backBtn: {
    flex: 1,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#B7A892',
  },
  backText: { fontSize: 13, fontWeight: '700', color: theme.primaryDark },
  confirmBtn: {
    flex: 1.6,
    height: 34,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.dangerSoft,
  },
  confirmText: { fontSize: 12, fontWeight: '600', color: theme.danger },
});
