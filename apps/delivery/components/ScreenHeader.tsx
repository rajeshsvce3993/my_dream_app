import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing, theme } from '../lib/theme';

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  /** Optional online/offline status chip on the right */
  statusOnline?: boolean;
  statusLabel?: string;
};

/** Navy top chrome for delivery screens. */
export function ScreenHeader({ title, subtitle, onBack, statusOnline, statusLabel }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        backgroundColor: theme.headerBg,
        paddingTop: insets.top + spacing.xs,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44 }}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={12}
            style={{ width: 40, marginRight: 4 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color={theme.onHeader} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: '800',
              color: theme.onHeader,
              letterSpacing: -0.2,
            }}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={{
                marginTop: 2,
                fontSize: 12,
                fontWeight: '600',
                color: theme.onHeaderMuted,
              }}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {statusLabel ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: statusOnline ? 'rgba(47,125,92,0.22)' : 'rgba(155,184,198,0.18)',
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: radius.full,
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: statusOnline ? theme.success : theme.onHeaderMuted,
              }}
            />
            <Text style={{ fontSize: 12, fontWeight: '800', color: theme.onHeader }}>{statusLabel}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
