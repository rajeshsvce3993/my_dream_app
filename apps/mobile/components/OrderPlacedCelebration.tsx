import { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme, spacing, radius } from '../lib/theme';

type Props = {
  orderNumber: string;
  visible: boolean;
};

/** Brief success pulse after checkout — pairs with order-placed toast. */
export function OrderPlacedCelebration({ orderNumber, visible }: Props) {
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0.6);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [visible, opacity, scale]);

  if (!visible) return null;

  return (
    <Animated.View style={{ marginBottom: spacing.sm, opacity, transform: [{ scale }] }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: theme.white,
          borderRadius: radius.sm,
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderWidth: 1,
          borderColor: theme.success,
        }}
      >
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: theme.success,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="checkmark" size={18} color={theme.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '800', fontSize: 13, color: theme.text }}>Order placed</Text>
          <Text style={{ color: theme.muted, marginTop: 1, fontSize: 11 }}>
            #{orderNumber} is confirmed
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}
