import { useEffect, useRef } from 'react';
import { Animated, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCartFeedback } from '../lib/cartFeedback';
import { theme } from '../lib/theme';

type Props = {
  productId: string;
  loading?: boolean;
  size?: number;
};

/** Green check pulse on the + control after a successful add. */
export function AddToCartButtonPulse({ productId, loading, size = 32 }: Props) {
  const { lastAddedProductId, addedPulse, isRecentlyAdded } = useCartFeedback();
  const scale = useRef(new Animated.Value(1)).current;
  const showSuccess = isRecentlyAdded(productId);

  useEffect(() => {
    if (lastAddedProductId !== productId) return;
    scale.setValue(0.85);
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.15, friction: 4, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();
  }, [addedPulse, lastAddedProductId, productId, scale]);

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        backgroundColor: showSuccess && !loading ? theme.success : theme.primary,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ scale }],
      }}
    >
      {loading ? (
        <ActivityIndicator size="small" color="white" />
      ) : showSuccess ? (
        <Ionicons name="checkmark" size={20} color="white" />
      ) : (
        <Ionicons name="add" size={20} color="white" />
      )}
    </Animated.View>
  );
}
