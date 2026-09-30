import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { text } from '../lib/locale';
import { openConfiguredPath } from '../lib/mobileNavigation';
import { useAppLocation } from '../lib/usePublicConfig';
import { theme, spacing, radius, shadow } from '../lib/theme';

export type PromoSlide = {
  label: { en: string; ta?: string };
  subtitle?: { en: string; ta?: string };
  ctaLabel?: { en: string; ta?: string };
  ctaPath?: string;
  imageUrl?: string;
  backgroundColor?: string;
};

type Props = {
  promos: PromoSlide[];
};

const FALLBACK_FOOD_IMAGES = [
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
    imageUrl: FALLBACK_FOOD_IMAGES[0],
  },
  {
    label: { en: 'Flat ₹100 OFF on orders above ₹200', ta: '₹200-க்கு மேல் Flat ₹100 OFF' },
    subtitle: { en: 'No code needed · auto applied', ta: 'கோட் தேவையில்லை' },
    ctaLabel: { en: 'Order now', ta: 'ஆர்டர்' },
    ctaPath: '/restaurants',
    imageUrl: FALLBACK_FOOD_IMAGES[1],
  },
  {
    label: { en: 'Free delivery on select kitchens', ta: 'தேர்ந்த உணவகங்களில் இலவச டெலிவரி' },
    subtitle: { en: 'Limited slots near you', ta: 'அருகில் வரையறுக்கப்பட்ட slot' },
    ctaLabel: { en: 'Browse', ta: 'பார்க்க' },
    ctaPath: '/restaurants',
    imageUrl: FALLBACK_FOOD_IMAGES[2],
  },
];

const BANNER_BG = theme.bannerBg;
const IMG_W = 76;
const IMG_H = 84;
const AUTO_MS = 3200;

function PromoCard({
  slide,
  width,
  imageFallbackIndex,
}: {
  slide: PromoSlide;
  width: number;
  imageFallbackIndex: number;
}) {
  const location = useAppLocation();
  const [imgFailed, setImgFailed] = useState(false);
  const fallback = FALLBACK_FOOD_IMAGES[imageFallbackIndex % FALLBACK_FOOD_IMAGES.length]!;
  const imageUri = !imgFailed && slide.imageUrl?.trim() ? slide.imageUrl.trim() : fallback;

  return (
    <Pressable
      onPress={() => openConfiguredPath(slide.ctaPath ?? '/restaurants', { location })}
      style={{
        width,
        backgroundColor: BANNER_BG,
        borderRadius: radius.md,
        overflow: 'hidden',
        flexDirection: 'row',
        minHeight: IMG_H,
        borderWidth: 1,
        borderColor: theme.border,
        ...shadow.card,
      }}
      accessibilityRole="button"
      accessibilityLabel={text(slide.label)}
    >
      <View
        style={{
          flex: 1,
          paddingVertical: spacing.sm,
          paddingLeft: spacing.md,
          paddingRight: spacing.xs,
          justifyContent: 'center',
          gap: 3,
        }}
      >
        <Text
          style={{
            color: '#F4E8EB',
            fontWeight: '800',
            fontSize: 13,
            lineHeight: 17,
            letterSpacing: -0.1,
          }}
          numberOfLines={2}
        >
          {text(slide.label)}
        </Text>
        {slide.subtitle ? (
          <Text
            style={{ color: 'rgba(244,232,235,0.78)', fontSize: 11, fontWeight: '600', lineHeight: 14 }}
            numberOfLines={1}
          >
            {text(slide.subtitle)}
          </Text>
        ) : null}
        <Text style={{ color: theme.bg, fontWeight: '800', fontSize: 11, marginTop: 2 }}>
          {text(slide.ctaLabel, 'Grab it')} ›
        </Text>
      </View>
      <View
        style={{
          width: IMG_W,
          height: IMG_H,
          backgroundColor: theme.white,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Image
          key={imageUri}
          source={{ uri: imageUri }}
          style={{ width: IMG_W, height: IMG_H, backgroundColor: theme.white }}
          resizeMode="cover"
          onError={() => {
            if (!imgFailed) setImgFailed(true);
          }}
        />
      </View>
    </Pressable>
  );
}

/** Auto-scrolling flat offer banners (no dropdown). */
export function HomePromoBanner({ promos }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const indexRef = useRef(0);
  const [active, setActive] = useState(0);
  const pausing = useRef(false);

  const slides = useMemo(() => {
    const fromConfig = (promos ?? []).filter((p) => p?.label);
    const hasFlat50FirstOrder = fromConfig.some((p) => {
      const hay = `${p.label?.en ?? ''} ${p.subtitle?.en ?? ''}`.toLowerCase();
      return hay.includes('50%') && hay.includes('first');
    });
    // Stale admin/API promos often omit the first-order deal — keep defaults then
    if (hasFlat50FirstOrder && fromConfig.length >= 2) {
      return fromConfig.slice(0, 3);
    }
    return DEFAULT_OFFERS;
  }, [promos]);

  const screenW = Dimensions.get('window').width;
  const sidePad = spacing.lg;
  const gap = spacing.sm;
  const cardW = screenW - sidePad * 2;
  const snap = cardW + gap;

  useEffect(() => {
    if (slides.length < 2) return;

    const id = setInterval(() => {
      if (pausing.current) return;
      const next = (indexRef.current + 1) % slides.length;
      indexRef.current = next;
      setActive(next);
      scrollRef.current?.scrollTo({ x: next * snap, animated: true });
    }, AUTO_MS);

    return () => clearInterval(id);
  }, [slides.length, snap]);

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const x = e.nativeEvent.contentOffset.x;
    const i = Math.round(x / snap);
    const clamped = Math.max(0, Math.min(slides.length - 1, i));
    indexRef.current = clamped;
    setActive(clamped);
  }

  if (!slides.length) return null;

  return (
    <View style={{ marginBottom: spacing.md }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled={false}
        decelerationRate="fast"
        snapToInterval={snap}
        snapToAlignment="start"
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => {
          pausing.current = true;
        }}
        onScrollEndDrag={() => {
          pausing.current = false;
        }}
        onMomentumScrollEnd={onScrollEnd}
        contentContainerStyle={{
          paddingHorizontal: sidePad,
          gap,
        }}
      >
        {slides.map((slide, i) => (
          <PromoCard
            key={`${text(slide.label)}-${i}`}
            slide={slide}
            width={cardW}
            imageFallbackIndex={i}
          />
        ))}
      </ScrollView>

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 6,
          marginTop: spacing.sm,
        }}
      >
        {slides.map((_, i) => (
          <View
            key={i}
            style={{
              width: active === i ? 16 : 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: active === i ? theme.headerBg : theme.border,
            }}
          />
        ))}
      </View>
    </View>
  );
}
