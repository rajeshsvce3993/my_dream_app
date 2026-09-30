import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { markOnboardingComplete } from '../lib/onboardingStorage';
import { theme, spacing, radius } from '../lib/theme';

const { width: SCREEN_W } = Dimensions.get('window');

type Slide = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    key: 'nearby',
    icon: 'restaurant-outline',
    title: 'Kitchens near you',
    body: 'Browse neighborhood restaurants and order what you are craving in a few taps.',
  },
  {
    key: 'menu',
    icon: 'fast-food-outline',
    title: 'Menus that make sense',
    body: 'Clear prices, veg and non-veg filters, and dishes you can add without the clutter.',
  },
  {
    key: 'track',
    icon: 'bicycle-outline',
    title: 'From kitchen to door',
    body: 'Place your order, follow every step, and know when your food is on the way.',
  },
];

export default function OnboardingScreen() {
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    fade.setValue(0);
    rise.setValue(18);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(rise, {
        toValue: 0,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [index, fade, rise]);

  const finish = useCallback(async () => {
    if (finishing) return;
    setFinishing(true);
    try {
      await markOnboardingComplete();
    } finally {
      router.replace('/(tabs)');
    }
  }, [finishing]);

  const goNext = useCallback(() => {
    if (index >= SLIDES.length - 1) {
      void finish();
      return;
    }
    const next = index + 1;
    listRef.current?.scrollToIndex({ index: next, animated: true });
    setIndex(next);
  }, [finish, index]);

  const onMomentumEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    setIndex(Math.max(0, Math.min(SLIDES.length - 1, i)));
  }, []);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) setIndex(first.index);
  }).current;

  const isLast = index === SLIDES.length - 1;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[theme.headerBg, '#152F3C', theme.bg]}
        locations={[0, 0.38, 0.72]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <View style={styles.mark}>
              <Text style={styles.mono}>DF</Text>
            </View>
            <Text style={styles.brand}>Dream Food</Text>
          </View>
          {!isLast ? (
            <Pressable onPress={() => void finish()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Skip">
              <Text style={styles.skip}>Skip</Text>
            </Pressable>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        <FlatList
          ref={listRef}
          data={SLIDES}
          keyExtractor={(s) => s.key}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          onMomentumScrollEnd={onMomentumEnd}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ viewAreaCoveragePercentThreshold: 60 }}
          getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
          renderItem={({ item }) => (
            <View style={[styles.slide, { width: SCREEN_W }]}>
              <View style={{ alignItems: 'center' }}>
                <View style={styles.iconPlate}>
                  <Ionicons name={item.icon} size={40} color={theme.onHeader} />
                </View>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.body}>{item.body}</Text>
              </View>
            </View>
          )}
        />

        <Animated.View style={[styles.footer, { opacity: fade, transform: [{ translateY: rise }] }]}>
          <View style={styles.dots}>
            {SLIDES.map((s, i) => (
              <View key={s.key} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>

          <Pressable
            onPress={goNext}
            disabled={finishing}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }, finishing && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityLabel={isLast ? 'Get started' : 'Continue'}
          >
            <Text style={styles.ctaText}>{isLast ? 'Get started' : 'Continue'}</Text>
            <Ionicons name={isLast ? 'arrow-forward' : 'chevron-forward'} size={18} color={theme.onHeader} />
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.headerBg,
  },
  safe: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mark: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: theme.delivery,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mono: {
    fontSize: 13,
    fontWeight: '900',
    color: theme.onHeader,
    letterSpacing: 0.5,
  },
  brand: {
    fontSize: 17,
    fontWeight: '900',
    color: theme.onHeader,
    letterSpacing: -0.3,
  },
  skip: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.onHeaderMuted,
  },
  slide: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    paddingBottom: 24,
  },
  iconPlate: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: 'rgba(62,138,154,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(240,247,250,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: theme.onHeader,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    color: theme.onHeaderMuted,
    textAlign: 'center',
    maxWidth: 320,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(155,184,198,0.35)',
  },
  dotActive: {
    width: 22,
    backgroundColor: theme.delivery,
  },
  cta: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: theme.delivery,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.onHeader,
  },
});
