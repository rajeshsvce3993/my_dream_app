import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../lib/api';
import { useCartFeedback } from '../lib/cartFeedback';
import { openLogin } from '../lib/openLogin';
import { useAuthSession } from '../lib/useAuthSession';
import { screenHeaderStyles } from '../lib/screenHeaderStyles';
import { theme, radius } from '../lib/theme';

const CART_RETURN = '/(tabs)/cart';

export function HeaderCartButton() {
  const { hasToken } = useAuthSession();
  const cart = useQuery({
    queryKey: ['mobile-cart'],
    queryFn: () => apiRequest<{ lines: Array<{ quantity: number }> }>('/cart'),
    enabled: hasToken === true,
    retry: false,
    staleTime: 30_000,
  });
  const count = cart.data?.lines.reduce((s, l) => s + l.quantity, 0) ?? 0;
  const { addedPulse } = useCartFeedback();
  const badgeScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!addedPulse) return;
    badgeScale.setValue(1);
    Animated.sequence([
      Animated.spring(badgeScale, { toValue: 1.35, friction: 4, useNativeDriver: true }),
      Animated.spring(badgeScale, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();
  }, [addedPulse, badgeScale]);

  function onPress() {
    if (hasToken === false) {
      openLogin(CART_RETURN);
      return;
    }
    router.push('/(tabs)/cart');
  }

  return (
    <Pressable hitSlop={8} style={{ padding: 4 }} onPress={onPress} accessibilityLabel="Open cart">
      <Ionicons
        name="cart-outline"
        size={screenHeaderStyles.cartIconSize}
        color={screenHeaderStyles.cartIconColor}
      />
      {count > 0 ? (
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            backgroundColor: theme.primary,
            borderRadius: radius.full,
            minWidth: 16,
            height: 16,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: badgeScale }],
          }}
        >
          <Text style={{ color: 'white', fontSize: 10, fontWeight: '700' }}>{count}</Text>
        </Animated.View>
      ) : null}
    </Pressable>
  );
}
