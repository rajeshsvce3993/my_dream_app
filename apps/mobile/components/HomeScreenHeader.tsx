import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppLocation, usePublicConfig } from '../lib/usePublicConfig';
import { theme, spacing, radius } from '../lib/theme';
import { text } from '../lib/locale';

function cityFromLabel(label: string): string {
  const city = label.split(',')[0]?.trim();
  return city || label;
}

function brandMonogram(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return 'DF';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

/** Home header: original monogram + brand name; location on the right. */
export function HomeScreenHeader() {
  const insets = useSafeAreaInsets();
  const location = useAppLocation();
  const config = usePublicConfig();
  const city = cityFromLabel(location.label);

  const brandName =
    (config.data?.['brand.name'] as string | undefined)?.trim() ||
    text(
      (config.data?.['mobile.home.foodMode'] as { brandName?: { en: string } } | undefined)?.brandName,
      'Dream Food',
    );
  const mono = brandMonogram(brandName);

  return (
    <View
      style={{
        paddingTop: insets.top + spacing.xs,
        paddingHorizontal: spacing.lg,
        paddingBottom: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: theme.headerBg,
        gap: spacing.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, maxWidth: '48%' }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radius.md,
            backgroundColor: theme.delivery,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          accessibilityRole="image"
          accessibilityLabel={`${brandName} logo`}
        >
          <Text style={{ fontSize: 13, fontWeight: '900', color: theme.onHeader, letterSpacing: 0.5 }}>
            {mono}
          </Text>
        </View>
        <Text
          style={{ fontSize: 17, fontWeight: '900', color: theme.onHeader, letterSpacing: -0.3 }}
          numberOfLines={1}
        >
          {brandName}
        </Text>
      </View>

      <Pressable
        onPress={() => router.push('/(tabs)/account')}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '48%' }}
        accessibilityRole="button"
        accessibilityLabel={`Delivery location ${city}`}
      >
        <Ionicons name="location-sharp" size={16} color={theme.onHeaderMuted} />
        <Text style={{ fontSize: 13, fontWeight: '700', color: theme.onHeader, flexShrink: 1 }} numberOfLines={1}>
          {city}
        </Text>
        <Ionicons name="chevron-down" size={14} color={theme.onHeaderMuted} />
      </Pressable>
    </View>
  );
}
