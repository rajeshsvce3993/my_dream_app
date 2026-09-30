import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../lib/theme';

type Props = {
  name: keyof typeof Ionicons.glyphMap;
  outlineName: keyof typeof Ionicons.glyphMap;
  label: string;
  focused: boolean;
};

export function AnimatedTabIcon({ name, outlineName, label, focused }: Props) {
  const scale = useRef(new Animated.Value(focused ? 1 : 0.92)).current;
  const dot = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const labelOpacity = useRef(new Animated.Value(focused ? 1 : 0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: focused ? 1 : 0.92,
        useNativeDriver: true,
        speed: 24,
        bounciness: focused ? 8 : 0,
      }),
      Animated.timing(dot, {
        toValue: focused ? 1 : 0,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(labelOpacity, {
        toValue: focused ? 1 : 0.85,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused, scale, dot, labelOpacity]);

  const color = focused ? theme.headerBg : theme.tabInactive;
  const dotScale = dot.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });

  return (
    <View style={styles.tabItem}>
      <Animated.View style={[styles.activeDot, { opacity: dot, transform: [{ scale: dotScale }] }]} />
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name={focused ? name : outlineName} size={22} color={color} />
      </Animated.View>
      <Animated.Text
        style={[styles.label, { color, fontWeight: focused ? '700' : '500', opacity: labelOpacity }]}
      >
        {label}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 52,
    paddingTop: 0,
  },
  label: {
    fontSize: 10,
    marginTop: 4,
    letterSpacing: 0.15,
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.headerBg,
    marginBottom: 3,
  },
});
