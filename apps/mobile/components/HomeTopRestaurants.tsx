import { Image, Pressable, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { text } from '../lib/locale';
import { theme, spacing, radius, shadow } from '../lib/theme';

export type TopRestaurantCard = {
  id: string;
  name: string;
  rating: number;
  distanceKm?: number;
  deliveryEstimateMinutes?: number;
  imageUrl?: string;
  offerPercent?: number;
};

type Props = {
  title?: { en: string; ta?: string };
  vendors: TopRestaurantCard[];
  viewAllPath?: string;
  viewAllLabel?: { en: string; ta?: string } | string;
};

/** Vertical restaurant list on home (scrolls with the page). */
export function HomeTopRestaurants({ title, vendors, viewAllPath, viewAllLabel }: Props) {
  if (!vendors.length) return null;

  const viewLabel =
    typeof viewAllLabel === 'string' ? viewAllLabel : text(viewAllLabel, 'View all');

  return (
    <View style={{ marginBottom: spacing.lg, paddingHorizontal: spacing.lg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.sm,
          gap: spacing.sm,
        }}
      >
        <Text style={{ fontWeight: '800', fontSize: 18, color: theme.text, flex: 1 }} numberOfLines={1}>
          {text(title, 'Top restaurants')}
        </Text>
        <Pressable
          onPress={() => router.push((viewAllPath || '/restaurants') as Href)}
          hitSlop={8}
          accessibilityRole="link"
        >
          <Text style={{ color: '#1B5E3B', fontWeight: '800', fontSize: 13 }}>{viewLabel} ›</Text>
        </Pressable>
      </View>

      <View style={{ gap: spacing.md }}>
        {vendors.map((v) => {
          const mins = v.deliveryEstimateMinutes ?? 30;
          const timeLabel = `${Math.max(15, mins - 5)}-${mins + 5} mins`;
          const initial = (v.name.trim()[0] ?? 'R').toUpperCase();
          return (
            <Pressable
              key={v.id}
              onPress={() => router.push(`/vendors/${v.id}` as Href)}
              style={{
                flexDirection: 'row',
                backgroundColor: theme.white,
                borderRadius: radius.lg,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: theme.border,
                ...shadow.card,
              }}
            >
              <View
                style={{
                  width: 88,
                  height: 88,
                  backgroundColor: theme.headerBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {v.imageUrl ? (
                  <Image
                    source={{ uri: v.imageUrl }}
                    style={{ width: 88, height: 88 }}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={{ fontSize: 28, fontWeight: '800', color: theme.onHeader }}>{initial}</Text>
                )}
              </View>
              <View
                style={{
                  flex: 1,
                  padding: spacing.sm,
                  paddingRight: spacing.md,
                  justifyContent: 'center',
                  gap: 4,
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '800', color: theme.text }} numberOfLines={2}>
                  {v.name}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Ionicons name="star" size={13} color={theme.success} />
                    <Text style={{ fontWeight: '700', fontSize: 12, color: theme.text }}>
                      {v.rating.toFixed(1)}
                    </Text>
                  </View>
                  <Text style={{ color: theme.muted, fontSize: 12 }}>{timeLabel}</Text>
                  {v.distanceKm != null ? (
                    <Text style={{ color: theme.muted, fontSize: 12 }}>{v.distanceKm.toFixed(1)} km</Text>
                  ) : null}
                </View>
                {v.offerPercent ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Ionicons name="pricetag-outline" size={13} color={theme.discount} />
                    <Text style={{ color: theme.discount, fontWeight: '600', fontSize: 11 }} numberOfLines={1}>
                      Up to {v.offerPercent}% off on selected orders
                    </Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
