import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useQuickAddToCart } from '../../lib/useQuickAddToCart';
import { Pressable, ScrollView, Text, View, ActivityIndicator } from 'react-native';
import { HomeScreenHeader } from '../../components/HomeScreenHeader';
import { HomeFeedSections } from '../../components/HomeFeedSections';
import type { FoodModeConfig, HomeServiceTab } from '../../components/HomeFoodModeTab';
import { apiRequest } from '../../lib/api';
import { useAppLocation, usePublicConfig } from '../../lib/usePublicConfig';
import { text } from '../../lib/locale';
import { theme, spacing, radius } from '../../lib/theme';

type HomeFeed = {
  sections: Array<{ id: string; type: string; title?: { en: string }; data: unknown }>;
};

export default function HomeScreen() {
  const quickAdd = useQuickAddToCart();
  const location = useAppLocation();
  const config = usePublicConfig();
  const currency = (config.data?.['currency.symbol'] as string) ?? '₹';
  const foodMode = config.data?.['mobile.home.foodMode'] as FoodModeConfig | undefined;
  const searchPlaceholder = text(
    config.data?.['mobile.search.placeholder'] as { en: string; ta?: string } | undefined,
    'Search food, grocery, gifts, etc.',
  );

  const feed = useQuery({
    queryKey: ['mobile-home-feed', location.lng, location.lat],
    queryFn: () =>
      apiRequest<HomeFeed>(`/catalog/home?lng=${location.lng}&lat=${location.lat}`),
    staleTime: 60_000,
    retry: 2,
  });

  /** Food tab only — grocery / other verticals stay off the home tab strip. */
  const serviceTabs = useMemo((): HomeServiceTab[] => {
    return [
      {
        id: 'food',
        label: foodMode?.tabLabel ?? { en: 'Crave Drop', ta: 'கிரேவ் டிராப்' },
        status: 'live',
        mobileHref: '/restaurants',
        isPrimary: true,
      },
    ];
  }, [foodMode?.tabLabel]);

  const apiDown = feed.isError;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <HomeScreenHeader />
      <View style={{ flex: 1 }}>
        {apiDown ? (
          <Pressable
            onPress={() => {
              feed.refetch();
              config.refetch();
            }}
            style={{
              marginHorizontal: spacing.lg,
              marginTop: spacing.sm,
              marginBottom: spacing.sm,
              padding: spacing.md,
              backgroundColor: theme.accent,
              borderRadius: radius.md,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 13, textAlign: 'center' }}>
              {(feed.error as Error)?.message ?? "Can't reach the store API. Tap to retry."}
            </Text>
          </Pressable>
        ) : null}
        {feed.isLoading && !feed.data ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <ActivityIndicator color={theme.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }} showsVerticalScrollIndicator={false}>
            <HomeFeedSections
              sections={feed.data?.sections ?? []}
              currency={currency}
              searchPlaceholder={searchPlaceholder}
              foodMode={foodMode}
              serviceTabs={serviceTabs}
              onAddProduct={(p) => quickAdd.mutate(p)}
            />
          </ScrollView>
        )}
      </View>
    </View>
  );
}
