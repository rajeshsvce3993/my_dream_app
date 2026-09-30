import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { text } from '../lib/locale';
import { spacing, theme } from '../lib/theme';

export type HomeServiceTab = {
  id: string;
  label: { en: string; ta?: string };
  status?: 'live' | 'coming_soon';
  mobileHref?: string;
  resolvedHref?: string;
  isPrimary?: boolean;
};

export type FoodModeConfig = {
  brandName?: { en: string; ta?: string };
  tabLabel?: { en: string; ta?: string };
  tagline?: { en: string; ta?: string };
};

type Props = {
  tabs?: HomeServiceTab[];
  config?: FoodModeConfig;
};

/** Crave Drop — warm parchment (swapped from banner) */
const TAB_BG = theme.tabChipBg;
const TAB_TEXT = theme.tabChipInk;
const TAB_MUTED = theme.muted;
const TAB_MARK_BG = theme.bannerBg;
const TAB_MARK_TEXT = '#F4E8EB';

const TAB_HALF_BLEED = 26;

const FOOD_TAB: HomeServiceTab = {
  id: 'food',
  label: { en: 'Crave Drop', ta: 'கிரேவ் டிராப்' },
  status: 'live',
  mobileHref: '/restaurants',
  isPrimary: true,
};

function monogramFromLabel(label: string): string {
  const cleaned = label.trim();
  if (!cleaned) return 'B';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

/**
 * Full-width home service tab — catchy label + motion.
 * No flame / competitor-style marks.
 */
export function HomeFoodModeTab({ tabs: tabsProp, config }: Props) {
  const tabs = useMemo(() => {
    const foodFromProp = tabsProp?.find((t) => t.id === 'food');
    if (foodFromProp) {
      return [
        {
          ...foodFromProp,
          label: config?.tabLabel ?? foodFromProp.label ?? FOOD_TAB.label,
        },
      ];
    }
    return [
      {
        ...FOOD_TAB,
        label: config?.tabLabel ?? FOOD_TAB.label,
      },
    ];
  }, [tabsProp, config?.tabLabel]);

  const food = tabs[0]!;
  const label = text(food.label);
  const tagline = text(config?.tagline, 'Hungry? Tap in · feast lands fast');
  const mono = monogramFromLabel(label);

  const enter = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const chevron = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(enter, {
      toValue: 1,
      useNativeDriver: true,
      speed: 18,
      bounciness: 10,
    }).start();

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const chevronLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(chevron, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(chevron, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    pulseLoop.start();
    chevronLoop.start();

    return () => {
      pulseLoop.stop();
      chevronLoop.stop();
    };
  }, [enter, pulse, chevron]);

  const enterTranslate = enter.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });
  const enterScale = enter.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1],
  });
  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.08, 0.2],
  });
  const glowScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.02],
  });
  const chevronX = chevron.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 5],
  });

  function onPressIn() {
    Animated.spring(press, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();
  }

  function onPressOut() {
    Animated.spring(press, {
      toValue: 1,
      useNativeDriver: true,
      speed: 28,
      bounciness: 6,
    }).start();
  }

  return (
    <View style={{ marginBottom: spacing.md }}>
      <View style={{ height: TAB_HALF_BLEED, backgroundColor: theme.headerBg }} />
      <Animated.View
        style={{
          marginTop: -TAB_HALF_BLEED,
          paddingHorizontal: spacing.lg,
          opacity: enter,
          transform: [{ translateY: enterTranslate }, { scale: enterScale }],
        }}
      >
        <View
          style={{
            width: '100%',
            borderRadius: 16,
            overflow: 'visible',
          }}
          accessibilityRole="tablist"
        >
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 4,
              right: 4,
              top: 4,
              bottom: 4,
              borderRadius: 14,
              backgroundColor: theme.bannerBg,
              opacity: glowOpacity,
              transform: [{ scale: glowScale }],
            }}
          />
          <Animated.View style={{ transform: [{ scale: press }] }}>
            <Pressable
              onPress={() => router.push('/restaurants')}
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              style={{
                width: '100%',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                backgroundColor: TAB_BG,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: 'rgba(28,23,20,0.12)',
                paddingVertical: 11,
                paddingHorizontal: 14,
                shadowColor: theme.headerBg,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
                elevation: 5,
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: true }}
              accessibilityLabel={label}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    backgroundColor: TAB_MARK_BG,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '900',
                      color: TAB_MARK_TEXT,
                      letterSpacing: 0.4,
                    }}
                  >
                    {mono}
                  </Text>
                </View>
                <View style={{ flexShrink: 1 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '900',
                      color: TAB_TEXT,
                      letterSpacing: 0.3,
                    }}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      color: TAB_MUTED,
                      marginTop: 1,
                    }}
                    numberOfLines={1}
                  >
                    {tagline}
                  </Text>
                </View>
              </View>
              <Animated.View style={{ transform: [{ translateX: chevronX }] }}>
                <Ionicons name="chevron-forward" size={22} color={theme.tabChipInk} />
              </Animated.View>
            </Pressable>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}
