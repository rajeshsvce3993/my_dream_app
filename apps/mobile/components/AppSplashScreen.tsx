import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../lib/theme';

type Props = {
  brandName?: string;
  tagline?: string;
};

/**
 * Branded boot splash — Harbor Night mark + quiet motion.
 * Shown while deciding onboarding vs home.
 */
export function AppSplashScreen({
  brandName = 'Dream Food',
  tagline = 'Neighborhood kitchens, delivered',
}: Props) {
  const markScale = useRef(new Animated.Value(0.82)).current;
  const markOpacity = useRef(new Animated.Value(0)).current;
  const wordOpacity = useRef(new Animated.Value(0)).current;
  const wordY = useRef(new Animated.Value(10)).current;
  const bar = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(markScale, { toValue: 1, friction: 7, tension: 70, useNativeDriver: true }),
        Animated.timing(markOpacity, { toValue: 1, duration: 420, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(wordOpacity, { toValue: 1, duration: 360, useNativeDriver: true }),
        Animated.timing(wordY, { toValue: 0, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(bar, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bar, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    ).start();
  }, [bar, markOpacity, markScale, pulse, wordOpacity, wordY]);

  const mono = brandName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase() || 'DF';

  const barX = bar.interpolate({ inputRange: [0, 1], outputRange: [-48, 48] });

  return (
    <View style={styles.root} accessibilityLabel={`${brandName} loading`}>
      <LinearGradient
        colors={[theme.primaryDark, theme.headerBg, '#132A38']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.glow} />

      <View style={styles.center}>
        <Animated.View style={{ opacity: markOpacity, transform: [{ scale: markScale }] }}>
          <Animated.View style={{ transform: [{ scale: pulse }] }}>
            <View style={styles.mark}>
              <Text style={styles.mono}>{mono}</Text>
            </View>
          </Animated.View>
        </Animated.View>

        <Animated.View style={{ opacity: wordOpacity, transform: [{ translateY: wordY }], alignItems: 'center' }}>
          <Text style={styles.brand}>{brandName}</Text>
          <Text style={styles.tagline}>{tagline}</Text>
        </Animated.View>
      </View>

      <View style={styles.footer}>
        <View style={styles.track}>
          <Animated.View style={[styles.thumb, { transform: [{ translateX: barX }] }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.headerBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: theme.delivery,
    opacity: 0.12,
    top: '28%',
  },
  center: {
    alignItems: 'center',
    gap: 22,
    paddingHorizontal: 32,
  },
  mark: {
    width: 88,
    height: 88,
    borderRadius: 26,
    backgroundColor: theme.delivery,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(240,247,250,0.18)',
  },
  mono: {
    fontSize: 28,
    fontWeight: '900',
    color: theme.onHeader,
    letterSpacing: 1,
  },
  brand: {
    fontSize: 28,
    fontWeight: '900',
    color: theme.onHeader,
    letterSpacing: -0.6,
  },
  tagline: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
    color: theme.onHeaderMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 56,
    alignItems: 'center',
  },
  track: {
    width: 56,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(155,184,198,0.28)',
    overflow: 'hidden',
  },
  thumb: {
    width: 22,
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.delivery,
    alignSelf: 'center',
  },
});
