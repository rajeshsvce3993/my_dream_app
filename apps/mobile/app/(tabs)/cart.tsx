import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiRequest } from '../../lib/api';
import { openLogin } from '../../lib/openLogin';
import { useAuthSession } from '../../lib/useAuthSession';
import { formatMoney } from '../../lib/format';
import { theme, spacing, radius, shadow } from '../../lib/theme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { screenHeaderStyles as h } from '../../lib/screenHeaderStyles';

type CartLine = {
  vendorId: string;
  variantId: string;
  productName: { en: string };
  imageUrl?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

type CartCalc = {
  grandTotal: number;
  subtotal: number;
  shippingTotal: number;
  lines: CartLine[];
};

const CART_RETURN = '/(tabs)/cart';

export default function CartScreen() {
  const qc = useQueryClient();
  const { hasToken } = useAuthSession();

  useEffect(() => {
    if (hasToken === false) {
      openLogin(CART_RETURN);
    }
  }, [hasToken]);

  const config = useQuery({
    queryKey: ['mobile-config-symbol'],
    queryFn: () => apiRequest<Record<string, unknown>>('/configuration/public'),
  });
  const currency = (config.data?.['currency.symbol'] as string) ?? '₹';

  const cart = useQuery({
    queryKey: ['mobile-cart'],
    queryFn: () => apiRequest<CartCalc>('/cart'),
    enabled: hasToken === true,
    retry: false,
  });

  useEffect(() => {
    if (hasToken !== true || !cart.isError) return;
    const msg = (cart.error as Error)?.message?.toLowerCase() ?? '';
    if (msg.includes('unauthorized') || msg.includes('401') || msg.includes('sign in')) {
      openLogin(CART_RETURN);
    }
  }, [hasToken, cart.isError, cart.error]);

  const updateQty = useMutation({
    mutationFn: (input: { variantId: string; vendorId: string; quantity: number }) =>
      apiRequest(`/cart/items/${input.variantId}`, {
        method: 'PATCH',
        body: JSON.stringify({ vendorId: input.vendorId, quantity: input.quantity }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mobile-cart'] }),
  });

  const lines = cart.data?.lines ?? [];
  const itemCount = lines.reduce((s, l) => s + l.quantity, 0);
  const isEmpty = !cart.isLoading && cart.data && lines.length === 0;

  if (hasToken !== true) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (cart.isLoading || cart.isError || !cart.data) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: theme.bg }}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (isEmpty) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <ScreenHeader title="Your Cart" showBack layout="centered" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: theme.successSoft,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: spacing.lg,
            }}
          >
            <Ionicons name="cart-outline" size={48} color={theme.primary} />
          </View>
          <Text style={{ fontWeight: '800', fontSize: 20, color: theme.text, textAlign: 'center' }}>
            Your cart is empty
          </Text>
          <Text
            style={{
              color: theme.muted,
              textAlign: 'center',
              marginTop: spacing.sm,
              lineHeight: 22,
              maxWidth: 280,
            }}
          >
            Browse home and tap + on items you need. They will show up here with your bill summary.
          </Text>
          <Pressable
            onPress={() => router.push('/(tabs)')}
            style={{
              marginTop: spacing.xl,
              backgroundColor: theme.primary,
              paddingHorizontal: 28,
              paddingVertical: 14,
              borderRadius: radius.md,
            }}
          >
            <Text style={{ color: 'white', fontWeight: '800' }}>Start shopping</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const deliveryFree = cart.data!.shippingTotal === 0;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScreenHeader
        title="Your Cart"
        showBack
        layout="centered"
        right={
          <View style={{ paddingHorizontal: 4, paddingVertical: 2, borderRadius: 6 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted }}>{itemCount} ITEMS</Text>
          </View>
        }
      />

      <ScrollView contentContainerStyle={{ ...h.bodyPadding, paddingBottom: 160 }}>
        {lines.map((line) => (
          <View
            key={`${line.vendorId}-${line.variantId}`}
            style={{
              flexDirection: 'row',
              backgroundColor: theme.surface,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: theme.border,
              padding: spacing.md,
              marginBottom: spacing.md,
              gap: spacing.md,
              ...shadow.card,
            }}
          >
            {line.imageUrl ? (
              <Image source={{ uri: line.imageUrl }} style={{ width: 72, height: 72, borderRadius: 10 }} />
            ) : (
              <View style={{ width: 72, height: 72, borderRadius: 10, backgroundColor: theme.border }} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', fontSize: 15 }}>{line.productName.en}</Text>
              <Text style={{ color: theme.muted, fontSize: 12, marginTop: 2 }}>Qty {line.quantity}</Text>
              <Text style={{ color: theme.primary, fontWeight: '800', marginTop: 6 }}>
                {formatMoney(currency, line.lineTotal)}
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  alignSelf: 'flex-start',
                  marginTop: 8,
                  backgroundColor: theme.successSoft,
                  borderRadius: radius.full,
                  paddingHorizontal: 4,
                }}
              >
                <Pressable
                  onPress={() =>
                    updateQty.mutate({
                      variantId: line.variantId,
                      vendorId: line.vendorId,
                      quantity: Math.max(0, line.quantity - 1),
                    })
                  }
                  style={{ padding: 8 }}
                >
                  <Text style={{ fontWeight: '800' }}>−</Text>
                </Pressable>
                <Text style={{ fontWeight: '800', minWidth: 24, textAlign: 'center' }}>{line.quantity}</Text>
                <Pressable
                  onPress={() =>
                    updateQty.mutate({
                      variantId: line.variantId,
                      vendorId: line.vendorId,
                      quantity: line.quantity + 1,
                    })
                  }
                  style={{ padding: 8 }}
                >
                  <Text style={{ fontWeight: '800' }}>+</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ))}

        <View style={{ backgroundColor: theme.neutralSoft, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.sm }}>
          <Text style={{ fontWeight: '800', marginBottom: spacing.md }}>Bill Summary</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ color: theme.muted }}>Item Total</Text>
            <Text style={{ fontWeight: '600' }}>{formatMoney(currency, cart.data!.subtotal)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.muted }}>Delivery Charge</Text>
            <Text style={{ fontWeight: '800', color: deliveryFree ? theme.success : theme.text }}>
              {deliveryFree ? 'FREE' : formatMoney(currency, cart.data!.shippingTotal)}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          flexDirection: 'row',
          alignItems: 'center',
          padding: spacing.lg,
          backgroundColor: theme.surface,
          borderTopWidth: 1,
          borderTopColor: theme.border,
          gap: spacing.md,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '800', fontSize: 20 }}>{formatMoney(currency, cart.data!.grandTotal)}</Text>
          <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '600' }}>VIEW DETAILED BILL</Text>
        </View>
        <Pressable
          onPress={() => router.push('/checkout')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: theme.primaryDark,
            paddingHorizontal: 20,
            paddingVertical: 14,
            borderRadius: radius.md,
          }}
        >
          <Text style={{ color: 'white', fontWeight: '800' }}>Proceed to Pay</Text>
          <Ionicons name="chevron-forward" size={18} color="white" />
        </Pressable>
      </View>
    </View>
  );
}
