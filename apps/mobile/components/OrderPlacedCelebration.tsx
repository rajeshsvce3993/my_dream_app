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
    <Animated.View
      style={{
        marginHorizontal: spacing.lg,
        marginBottom: spacing.md,
        opacity,
        transform: [{ scale }],
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          backgroundColor: theme.successSoft,
          borderRadius: radius.lg,
          padding: spacing.lg,
          borderWidth: 1,
          borderColor: theme.success,
        }}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: theme.success,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="checkmark" size={28} color="white" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '800', fontSize: 17, color: theme.text }}>Thank you!</Text>
          <Text style={{ color: theme.muted, marginTop: 4, fontSize: 13 }}>
            Order <Text style={{ fontWeight: '700', color: theme.primaryDark }}>#{orderNumber}</Text> is
            confirmed.
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}
