import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { theme } from '../lib/theme';

/** Full-screen boot mark. No app header or tab bar. */
export function VendorSplash() {
  const markOpacity = useRef(new Animated.Value(0)).current;
  const markScale = useRef(new Animated.Value(0.86)).current;
  const wordOpacity = useRef(new Animated.Value(0)).current;
  const bar = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(markOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.spring(markScale, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }),
      ]),
      Animated.timing(wordOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(bar, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bar, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    ).start();
  }, [bar, markOpacity, markScale, wordOpacity]);

  const barX = bar.interpolate({ inputRange: [0, 1], outputRange: [-36, 36] });

  return (
    <View style={styles.root} accessibilityLabel="Dream Vendor loading">
      <View style={styles.glow} />
      <Animated.View style={[styles.mark, { opacity: markOpacity, transform: [{ scale: markScale }] }]}>
        <Text style={styles.mono}>DV</Text>
      </Animated.View>
      <Animated.View style={{ opacity: wordOpacity, alignItems: 'center' }}>
        <Text style={styles.brand}>Dream Vendor</Text>
        <Text style={styles.tagline}>Kitchen orders, ready for the road</Text>
      </Animated.View>
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
    backgroundColor: theme.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: theme.delivery,
    opacity: 0.16,
  },
  mark: {
    width: 88,
    height: 88,
    borderRadius: 26,
    backgroundColor: theme.delivery,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(240,247,250,0.2)',
    marginBottom: 22,
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
    letterSpacing: -0.5,
  },
  tagline: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
    color: theme.onHeaderMuted,
  },
  footer: {
    position: 'absolute',
    bottom: 56,
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
  },
});
