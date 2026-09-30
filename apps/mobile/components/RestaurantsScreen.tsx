import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiRequestWithMeta } from '../lib/api';
import { text } from '../lib/locale';
import { serviceAreaCopy, type LocationAvailabilityMeta } from '../lib/locationMessages';
import { useAppLocation, usePublicConfig } from '../lib/usePublicConfig';
import { theme, spacing, radius, shadow } from '../lib/theme';
import { ScreenHeader } from './ScreenHeader';
import { screenHeaderStyles as h } from '../lib/screenHeaderStyles';
import type { CustomerVendorCard } from '../lib/vendorsQueryTypes';

type CuisineFilter = {
  id: string;
  label: { en: string; ta?: string };
  cuisineTags?: string[];
};

/** Fallback only when config key mobile.restaurants.cuisineFilters is missing from DB. */
const DEFAULT_FILTERS: CuisineFilter[] = [{ id: 'all', label: { en: 'All', ta: 'அனைத்தும்' } }];

function vendorMatchesCuisine(store: CustomerVendorCard, chip: CuisineFilter): boolean {
  if (!chip.cuisineTags?.length) return true;
  const tags = (store.cuisineTags ?? []).map((t) => t.toLowerCase());
  return chip.cuisineTags.some((t) => tags.includes(t.toLowerCase()));
}

type Props = {
  showBack?: boolean;
};

export function RestaurantsScreen({ showBack = true }: Props) {
  const insets = useSafeAreaInsets();
  const location = useAppLocation();
  const config = usePublicConfig();
  const currency = (config.data?.['currency.symbol'] as string) ?? '₹';
  const filters =
    (config.data?.['mobile.restaurants.cuisineFilters'] as CuisineFilter[] | undefined) ?? DEFAULT_FILTERS;
  const [activeFilter, setActiveFilter] = useState('all');

  const vendors = useQuery({
    queryKey: ['restaurants', location.lng, location.lat],
    queryFn: async () => {
      const { data, meta } = await apiRequestWithMeta<CustomerVendorCard[]>(
        `/vendors?lng=${location.lng}&lat=${location.lat}&limit=50`,
      );
      return {
        items: data,
        location: meta?.location as LocationAvailabilityMeta | undefined,
      };
    },
  });

  const activeChip = filters.find((f) => f.id === activeFilter) ?? filters[0];

  const filtered = useMemo(() => {
    const items = vendors.data?.items ?? [];
    if (!activeChip || activeChip.id === 'all') return items;
    return items.filter((v) => vendorMatchesCuisine(v, activeChip));
  }, [activeChip, vendors.data?.items]);

  function openRestaurant(id: string) {
    // Open the restaurant menu with all of that store’s products (no cuisine auto-filter)
    router.push(`/vendors/${id}` as Href);
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScreenHeader title="Restaurants" layout="centered" showBack={showBack} showCart />

      {/* Category chips — tab color on chips only, not the full strip */}
      <View
        style={{
          backgroundColor: theme.bg,
          paddingVertical: spacing.sm,
        }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}
        >
          {filters.map((f) => {
            const selected = f.id === activeFilter;
            return (
              <Pressable
                key={f.id}
                onPress={() => setActiveFilter(f.id)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: radius.full,
                  backgroundColor: selected ? theme.bannerBg : theme.tabChipBg,
                  borderWidth: 1,
                  borderColor: selected ? theme.bannerBg : 'transparent',
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text
                  style={{
                    fontWeight: selected ? '800' : '600',
                    fontSize: 13,
                    color: selected ? theme.white : theme.tabChipInk,
                  }}
                >
                  {text(f.label)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={vendors.isFetching} onRefresh={() => vendors.refetch()} />
        }
        contentContainerStyle={{
          ...h.bodyPadding,
          gap: spacing.md,
          paddingTop: spacing.md,
          // Extra room so the last restaurant card isn’t clipped by tab bar / home indicator
          paddingBottom: Math.max(insets.bottom, 8) + (showBack ? 32 : 72),
        }}
      >
        {activeChip && activeChip.id !== 'all' ? (
          <Text style={{ color: theme.muted, fontSize: 12, fontWeight: '600' }}>
            Showing {text(activeChip.label)} restaurants
          </Text>
        ) : null}

        {vendors.isLoading ? <ActivityIndicator color={theme.primary} /> : null}
        {filtered.map((store) => (
          <RestaurantCard
            key={store.id}
            store={store}
            currency={currency}
            cuisineLabels={
              (store.cuisineTags ?? [])
                .map((tag) => filters.find((f) => f.id === tag)?.label)
                .filter(Boolean)
                .map((l) => text(l as { en: string }))
            }
            onPress={() => openRestaurant(store.id)}
          />
        ))}
        {!vendors.isLoading && filtered.length === 0 ? (
          <EmptyRestaurants location={vendors.data?.location} allCount={vendors.data?.items?.length ?? 0} />
        ) : null}
      </ScrollView>
    </View>
  );
}

function RestaurantCard({
  store,
  currency,
  cuisineLabels,
  onPress,
}: {
  store: CustomerVendorCard;
  currency: string;
  cuisineLabels: string[];
  onPress: () => void;
}) {
  const mins = store.deliveryEstimateMinutes ?? 30;
  const timeLabel = `${Math.max(15, mins - 5)}-${mins + 5} mins`;
  const forTwo = store.minimumOrderAmount
    ? `${currency}${Math.round(store.minimumOrderAmount * 2)} for two`
    : `${store.productCount} items`;
  const initial = (store.name.trim()[0] ?? 'R').toUpperCase();

  return (
    <Pressable
      onPress={onPress}
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
        {store.imageUrl ? (
          <Image source={{ uri: store.imageUrl }} style={{ width: 88, height: 88 }} resizeMode="cover" />
        ) : (
          <Text style={{ fontSize: 32, fontWeight: '800', color: theme.onHeader }}>{initial}</Text>
        )}
      </View>
      <View style={{ flex: 1, padding: spacing.sm, paddingRight: spacing.md, justifyContent: 'center', gap: 4 }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: theme.text }} numberOfLines={2}>
          {store.name}
        </Text>
        {cuisineLabels.length ? (
          <Text style={{ color: theme.muted, fontSize: 11, fontWeight: '600' }} numberOfLines={1}>
            {cuisineLabels.join(' · ')}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Ionicons name="star" size={13} color={theme.success} />
            <Text style={{ fontWeight: '700', fontSize: 12, color: theme.text }}>
              {store.rating.toFixed(1)}
            </Text>
          </View>
          <Text style={{ color: theme.muted, fontSize: 12 }}>{timeLabel}</Text>
          <Text style={{ color: theme.muted, fontSize: 12 }}>{forTwo}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Ionicons name="bicycle-outline" size={13} color={theme.success} />
          <Text style={{ color: theme.success, fontWeight: '600', fontSize: 11 }} numberOfLines={1}>
            {store.isOpen
              ? (store.deliveryFee ?? 0) === 0
                ? 'Free delivery on select orders'
                : `Delivery ${currency}${store.deliveryFee}`
              : 'Currently closed'}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function EmptyRestaurants({
  location,
  allCount,
}: {
  location?: LocationAvailabilityMeta;
  allCount: number;
}) {
  if (location?.reason === 'OUTSIDE_SERVICE_AREA') {
    const copy = serviceAreaCopy(location);
    return (
      <View style={{ marginTop: 24, gap: 8 }}>
        <Text style={{ textAlign: 'center', fontWeight: '800', fontSize: 17 }}>{copy.title}</Text>
        <Text style={{ textAlign: 'center', color: theme.muted, lineHeight: 22 }}>{copy.body}</Text>
      </View>
    );
  }
  if (allCount > 0) {
    return (
      <Text style={{ textAlign: 'center', color: theme.muted, marginTop: 24 }}>
        No restaurants in this category. Try All or another cuisine.
      </Text>
    );
  }
  return (
    <Text style={{ textAlign: 'center', color: theme.muted, marginTop: 24, lineHeight: 22 }}>
      {location?.vendorListEmptyMessage ?? 'No restaurants near you yet. Try updating your delivery address.'}
    </Text>
  );
}
