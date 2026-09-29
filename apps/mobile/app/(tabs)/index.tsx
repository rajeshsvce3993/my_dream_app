import { useQuery } from '@tanstack/react-query';
import { useQuickAddToCart } from '../../lib/useQuickAddToCart';
import { Pressable, ScrollView, Text, View, ActivityIndicator } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { HomeFeedSections } from '../../components/HomeFeedSections';
import { apiRequest } from '../../lib/api';
import { useAppLocation, usePublicConfig } from '../../lib/usePublicConfig';
import { theme, spacing, radius } from '../../lib/theme';

type HomeFeed = {
  sections: Array<{ id: string; type: string; title?: { en: string }; data: unknown }>;
};

export default function HomeScreen() {
  const quickAdd = useQuickAddToCart();
  const location = useAppLocation();
  const config = usePublicConfig();
  const currency = (config.data?.['currency.symbol'] as string) ?? '₹';
  const categoryIcons =
    (config.data?.['mobile.categoryIcons'] as Record<string, string> | undefined) ?? {};
  const categoryLabels =
    (config.data?.['mobile.categoryLabels'] as Record<string, string> | undefined) ?? {};

  const feed = useQuery({
    queryKey: ['mobile-home-feed', location.lng, location.lat],
    queryFn: () =>
      apiRequest<HomeFeed>(`/catalog/home?lng=${location.lng}&lat=${location.lat}`),
    staleTime: 60_000,
    retry: 2,
  });

  const apiDown = feed.isError;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <AppHeader greeting />
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
              categoryIcons={categoryIcons}
              categoryLabels={categoryLabels}
              onAddProduct={(p) => quickAdd.mutate(p)}
            />
          </ScrollView>
        )}
      </View>
    </View>
  );
}
