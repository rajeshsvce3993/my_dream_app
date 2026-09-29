import { Ionicons } from '@expo/vector-icons';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { readHasAccessToken } from './authSession';
import { openLogin } from './openLogin';
import { theme, spacing, radius, shadow } from './theme';

type ToastPayload = {
  kind: 'cart' | 'order';
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
};

type CartFeedbackContextValue = {
  notifyItemAdded: (input: { productId: string; productName?: string }) => void;
  notifyOrderPlaced: (input: { orderNumber: string; totalLabel?: string }) => void;
  /** Bumps when any product was added — use for header badge pulse. */
  addedPulse: number;
  /** Product id for inline + button success animation. */
  lastAddedProductId: string | null;
  isRecentlyAdded: (productId: string) => boolean;
  orderPlacedPulse: number;
};

const CartFeedbackContext = createContext<CartFeedbackContextValue | null>(null);

export function useCartFeedback(): CartFeedbackContextValue {
  const ctx = useContext(CartFeedbackContext);
  if (!ctx) throw new Error('useCartFeedback must be used within CartFeedbackProvider');
  return ctx;
}

export function CartFeedbackProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastPayload | null>(null);
  const [addedPulse, setAddedPulse] = useState(0);
  const [orderPlacedPulse, setOrderPlacedPulse] = useState(0);
  const [lastAddedProductId, setLastAddedProductId] = useState<string | null>(null);
  const slide = useRef(new Animated.Value(120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [recentAdds, setRecentAdds] = useState<Record<string, number>>({});

  const hideToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(slide, { toValue: 120, duration: 220, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) setToast(null);
    });
  }, [opacity, slide]);

  const showToast = useCallback(
    (payload: ToastPayload, autoHideMs = 2800) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setToast(payload);
      slide.setValue(120);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(slide, { toValue: 0, useNativeDriver: true, friction: 8, tension: 80 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      hideTimer.current = setTimeout(hideToast, autoHideMs);
    },
    [hideToast, opacity, slide],
  );

  const notifyItemAdded = useCallback(
    (input: { productId: string; productName?: string }) => {
      setLastAddedProductId(input.productId);
      setAddedPulse((n) => n + 1);
      const at = Date.now();
      setRecentAdds((prev) => ({ ...prev, [input.productId]: at }));
      setTimeout(() => {
        setRecentAdds((prev) => {
          if (prev[input.productId] !== at) return prev;
          const next = { ...prev };
          delete next[input.productId];
          return next;
        });
      }, 2000);
      showToast({
        kind: 'cart',
        title: 'Added to cart',
        subtitle: input.productName,
        actionLabel: 'View cart',
      });
    },
    [showToast],
  );

  const notifyOrderPlaced = useCallback(
    (input: { orderNumber: string; totalLabel?: string }) => {
      setOrderPlacedPulse((n) => n + 1);
      showToast(
        {
          kind: 'order',
          title: 'Order placed!',
          subtitle: input.totalLabel
            ? `#${input.orderNumber} · ${input.totalLabel}`
            : `#${input.orderNumber}`,
          actionLabel: 'OK',
        },
        3500,
      );
    },
    [showToast],
  );

  const isRecentlyAdded = useCallback(
    (productId: string) => {
      const t = recentAdds[productId];
      return t != null && Date.now() - t < 2000;
    },
    [recentAdds],
  );

  const value = useMemo(
    () => ({
      notifyItemAdded,
      notifyOrderPlaced,
      addedPulse,
      lastAddedProductId,
      isRecentlyAdded,
      orderPlacedPulse,
    }),
    [addedPulse, isRecentlyAdded, lastAddedProductId, notifyItemAdded, notifyOrderPlaced, orderPlacedPulse],
  );

  return (
    <CartFeedbackContext.Provider value={value}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: spacing.lg,
            right: spacing.lg,
            bottom: 88,
            transform: [{ translateY: slide }],
            opacity,
            zIndex: 9999,
          }}
        >
          <Pressable
            onPress={() => {
              hideToast();
              if (toast.kind === 'cart') {
                void readHasAccessToken().then((signedIn) => {
                  if (signedIn) router.push('/(tabs)/cart');
                  else openLogin('/(tabs)/cart');
                });
              }
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              backgroundColor: toast.kind === 'order' ? theme.success : theme.primaryDark,
              paddingVertical: 14,
              paddingHorizontal: spacing.lg,
              borderRadius: radius.lg,
              ...shadow.card,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: 'rgba(255,255,255,0.2)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons
                name={toast.kind === 'order' ? 'checkmark-done-circle' : 'checkmark-circle'}
                size={26}
                color="white"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: 'white', fontWeight: '800', fontSize: 15 }}>{toast.title}</Text>
              {toast.subtitle ? (
                <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.92)', fontSize: 13, marginTop: 2 }}>
                  {toast.subtitle}
                </Text>
              ) : null}
            </View>
            <Text style={{ color: 'white', fontWeight: '800', fontSize: 13 }}>
              {toast.actionLabel ?? (toast.kind === 'cart' ? 'View cart' : 'OK')}
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </CartFeedbackContext.Provider>
  );
}
