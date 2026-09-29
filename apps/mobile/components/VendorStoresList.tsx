import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiRequestWithMeta } from '../lib/api';
import { serviceAreaCopy, type LocationAvailabilityMeta } from '../lib/locationMessages';
import { isStoresTabBlocked, showStoresTabUnavailableAlert } from '../lib/storesTabAlerts';
import { useAppLocation } from '../lib/usePublicConfig';
import { theme, spacing, radius, shadow } from '../lib/theme';
import { ScreenHeader } from './ScreenHeader';
import { screenHeaderStyles as h } from '../lib/screenHeaderStyles';

import type { CustomerVendorCard, VendorsQueryData } from '../lib/vendorsQueryTypes';

export type { VendorsQueryData };

type Props = {
  vendorsQuery?: UseQueryResult<VendorsQueryData>;
  blockStoreNavigation?: boolean;
};

export function VendorStoresList({ vendorsQuery, blockStoreNavigation }: Props = {} as Props) {
  const location = useAppLocation();

  const internalQuery = useQuery({
    queryKey: ['vendors', location.lng, location.lat],
    queryFn: async () => {
      const { data, meta } = await apiRequestWithMeta<CustomerVendorCard[]>(
        `/vendors?lng=${location.lng}&lat=${location.lat}&limit=50`,
      );
      return {
        items: data,
        location: meta?.location as LocationAvailabilityMeta | undefined,
      };
    },
    enabled: !vendorsQuery,
  });

  const vendors = vendorsQuery ?? internalQuery;

  function onStorePress(storeId: string) {
    const items = vendors.data?.items ?? [];
    const loc = vendors.data?.location;
    if (blockStoreNavigation && isStoresTabBlocked(loc, items.length)) {
      showStoresTabUnavailableAlert(loc);
      return;
    }
    router.push(`/vendors/${storeId}` as Href);
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScreenHeader title="Stores near you" showCart layout="leading" />
      <ScrollView
        contentContainerStyle={{ ...h.bodyPadding, gap: spacing.md }}
        refreshControl={
          <RefreshControl refreshing={vendors.isFetching} onRefresh={() => vendors.refetch()} />
        }
      >
        {vendors.isLoading ? <ActivityIndicator color={theme.primary} /> : null}
        {(vendors.data?.items ?? []).map((store) => (
            <Pressable
              key={store.id}
              onPress={() => onStorePress(store.id)}
              style={{
                borderRadius: radius.lg,
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.border,
                overflow: 'hidden',
                ...shadow.card,
              }}
            >
              <View
                style={{
                  height: 96,
                  backgroundColor: theme.successSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="storefront-outline" size={40} color={theme.primary} />
              </View>
              <View style={{ padding: spacing.md, gap: 6 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>{store.name}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  <Text style={{ color: theme.muted, fontWeight: '600' }}>★ {store.rating.toFixed(1)}</Text>
                  {store.distanceKm != null ? (
                    <Text style={{ color: theme.muted }}>{store.distanceKm.toFixed(1)} km</Text>
                  ) : null}
                  {store.deliveryEstimateMinutes ? (
                    <Text style={{ color: theme.muted }}>{store.deliveryEstimateMinutes} min</Text>
                  ) : null}
                </View>
                <Text style={{ color: store.isOpen ? theme.primary : theme.discount, fontWeight: '700' }}>
                  {store.isOpen ? 'Open' : 'Closed'}
                </Text>
                <Text style={{ color: theme.muted, fontSize: 12 }}>
                  {store.productCount} products · Free delivery ₹{store.freeDeliveryThreshold}+
                </Text>
              </View>
            </Pressable>
        ))}
        {!vendors.isLoading && !(vendors.data?.items?.length ?? 0) ? (
          vendors.data?.location?.reason === 'OUTSIDE_SERVICE_AREA' ? (
            <View style={{ marginTop: 24, paddingHorizontal: spacing.sm, gap: 8 }}>
              <Text style={{ textAlign: 'center', fontWeight: '800', fontSize: 17, color: theme.text }}>
                {serviceAreaCopy(vendors.data.location).title}
              </Text>
              <Text style={{ textAlign: 'center', color: theme.muted, lineHeight: 22 }}>
                {serviceAreaCopy(vendors.data.location).body}
              </Text>
            </View>
          ) : (
            <Text style={{ textAlign: 'center', color: theme.muted, marginTop: 24, lineHeight: 22 }}>
              {vendors.data?.location?.vendorListEmptyMessage ??
                'No stores available at your location. Try updating your delivery address.'}
            </Text>
          )
        ) : null}
      </ScrollView>
    </View>
  );
}
