import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, ScrollView, Text, View, Image } from 'react-native';
import { ScreenHeader } from './ScreenHeader';
import { type PromoSlide } from './HomePromoBanner';
import { text } from '../lib/locale';
import { openConfiguredPath } from '../lib/mobileNavigation';
import { useAppLocation, usePublicConfig } from '../lib/usePublicConfig';
import { theme, spacing, radius, shadow } from '../lib/theme';

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=400&h=320&q=80',
  'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=400&h=320&q=80',
  'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=400&h=320&q=80',
];

const DEFAULT_OFFERS: PromoSlide[] = [
  {
    label: { en: 'Flat 50% OFF on your first order', ta: 'முதல் ஆர்டரில் Flat 50% OFF' },
    subtitle: { en: 'New users · save up to ₹100', ta: 'புதிய பயனர்கள் · ₹100 வரை சேமிப்பு' },
    ctaLabel: { en: 'Grab it', ta: 'எடுங்கள்' },
    ctaPath: '/restaurants',
    imageUrl: FALLBACK_IMAGES[0],
  },
  {
    label: { en: 'Flat ₹100 OFF on orders above ₹200', ta: '₹200-க்கு மேல் Flat ₹100 OFF' },
    subtitle: { en: 'No code needed · auto applied', ta: 'கோட் தேவையில்லை' },
    ctaLabel: { en: 'Order now', ta: 'ஆர்டர்' },
    ctaPath: '/restaurants',
    imageUrl: FALLBACK_IMAGES[1],
  },
  {
    label: { en: 'Free delivery on select kitchens', ta: 'தேர்ந்த உணவகங்களில் இலவச டெலிவரி' },
    subtitle: { en: 'Limited slots near you', ta: 'அருகில் வரையறுக்கப்பட்ட slot' },
    ctaLabel: { en: 'Browse', ta: 'பார்க்க' },
    ctaPath: '/restaurants',
    imageUrl: FALLBACK_IMAGES[2],
  },
];

function OfferRow({
  offer,
  index,
}: {
  offer: PromoSlide;
  index: number;
}) {
  const location = useAppLocation();
  const fallback = FALLBACK_IMAGES[index % FALLBACK_IMAGES.length]!;
  const imageUri = offer.imageUrl?.trim() || fallback;

  return (
    <Pressable
      onPress={() => {
        if (offer.ctaPath) openConfiguredPath(offer.ctaPath, { location });
      }}
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
      <View style={{ width: 88, height: 88, backgroundColor: theme.bannerBg }}>
        <Image source={{ uri: imageUri }} style={{ width: 88, height: 88 }} resizeMode="cover" />
      </View>
      <View style={{ flex: 1, padding: spacing.sm, paddingRight: spacing.md, justifyContent: 'center', gap: 4 }}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: theme.text }} numberOfLines={2}>
          {text(offer.label)}
        </Text>
        {offer.subtitle ? (
          <Text style={{ fontSize: 12, color: theme.muted, fontWeight: '500' }} numberOfLines={2}>
            {text(offer.subtitle)}
          </Text>
        ) : null}
        {offer.ctaLabel ? (
          <Text style={{ fontSize: 12, fontWeight: '800', color: theme.bannerBg, marginTop: 2 }}>
            {text(offer.ctaLabel)} ›
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function OffersScreen() {
  const config = usePublicConfig();

  const offers = useQuery({
    queryKey: ['mobile-offers', config.dataUpdatedAt],
    queryFn: () => {
      const fromConfig =
        (config.data?.['mobile.home.promos'] as PromoSlide[] | undefined) ??
        (config.data?.['mobile.offers'] as PromoSlide[] | undefined);
      const list = (fromConfig ?? []).filter((p) => p?.label);
      return list.length ? list : DEFAULT_OFFERS;
    },
    enabled: !config.isLoading,
  });

  const items = offers.data ?? DEFAULT_OFFERS;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScreenHeader title="Offers" layout="centered" showCart />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        {config.isLoading || offers.isLoading ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: spacing.xl }} />
        ) : (
          items.map((offer, i) => (
            <OfferRow key={`${text(offer.label)}-${i}`} offer={offer} index={i} />
          ))
        )}
      </ScrollView>
    </View>
  );
}
