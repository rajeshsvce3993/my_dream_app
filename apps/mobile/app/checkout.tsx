import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiRequest } from '../lib/api';
import { text } from '../lib/locale';
import { useAppLocation } from '../lib/usePublicConfig';
import { formatMoney } from '../lib/format';
import { theme, spacing, radius, shadow } from '../lib/theme';
import { useCartFeedback } from '../lib/cartFeedback';
import { ScreenHeader } from '../components/ScreenHeader';
import { screenHeaderStyles as h } from '../lib/screenHeaderStyles';

type CartCalc = {
  grandTotal: number;
  subtotal: number;
  shippingTotal: number;
  lines: Array<{
    productName: { en: string };
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    imageUrl?: string;
  }>;
};

type DeliverySlotConfig = {
  id: string;
  icon?: string;
  title: { en: string };
  subtitle: { en: string };
};

const DEFAULT_SLOTS: DeliverySlotConfig[] = [
  { id: 'instant', icon: 'flash', title: { en: 'Instant' }, subtitle: { en: '10 MINS' } },
  { id: 'standard', icon: 'time-outline', title: { en: 'Standard' }, subtitle: { en: '30-40 MINS' } },
  { id: 'scheduled', icon: 'calendar-outline', title: { en: 'Schedule' }, subtitle: { en: 'CHOOSE TIME' } },
];

type PaymentMethod = 'COD' | 'RAZORPAY' | 'STRIPE';

const PAYMENT_OPTIONS: Array<{
  id: PaymentMethod;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  {
    id: 'COD',
    title: 'Cash on Delivery',
    subtitle: 'Pay when your order arrives',
    icon: 'cash-outline',
  },
  {
    id: 'RAZORPAY',
    title: 'UPI / Wallet',
    subtitle: 'PhonePe, GPay, Paytm & more',
    icon: 'phone-portrait-outline',
  },
  {
    id: 'STRIPE',
    title: 'Credit / Debit Card',
    subtitle: 'Visa, Mastercard, RuPay',
    icon: 'card-outline',
  },
];

function newIdempotencyKey(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { notifyOrderPlaced } = useCartFeedback();
  const location = useAppLocation();
  const [slot, setSlot] = useState('instant');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config = useQuery({
    queryKey: ['mobile-checkout-config'],
    queryFn: () => apiRequest<Record<string, unknown>>('/configuration/public'),
  });

  const cart = useQuery({
    queryKey: ['mobile-cart'],
    queryFn: () => apiRequest<CartCalc>('/cart'),
    retry: false,
  });

  const currency = (config.data?.['currency.symbol'] as string) ?? '₹';
  const timeSlots =
    (config.data?.['mobile.checkout.deliverySlots'] as DeliverySlotConfig[] | undefined) ?? DEFAULT_SLOTS;

  async function placeOrder() {
    setError(null);
    setLoading(true);
    try {
      const result = await apiRequest<{
        order: { _id: string; orderNumber: string; grandTotal: number };
      }>('/checkout', {
        method: 'POST',
        body: JSON.stringify({
          idempotencyKey: newIdempotencyKey(),
          paymentMethod,
          deliveryAddress: {
            line1: location.line1,
            city: location.city,
            country: location.country,
            lng: location.lng,
            lat: location.lat,
          },
        }),
      });
      await qc.invalidateQueries({ queryKey: ['mobile-cart'] });
      notifyOrderPlaced({
        orderNumber: result.order.orderNumber,
        totalLabel: formatMoney(currency, result.order.grandTotal),
      });
      router.replace({
        pathname: '/orders/[id]',
        params: { id: result.order._id, placed: '1' },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (cart.isLoading || !cart.data) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  const deliveryFree = cart.data.shippingTotal === 0;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScreenHeader title="Place order" showBack layout="centered" />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ ...h.bodyPadding, paddingBottom: spacing.xl }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
          <Text style={{ fontWeight: '800', fontSize: 16 }}>Delivery Address</Text>
          <Text style={{ color: theme.primary, fontWeight: '800', fontSize: 12 }}>CHANGE</Text>
        </View>
        <View
          style={{
            flexDirection: 'row',
            gap: spacing.md,
            backgroundColor: theme.surface,
            borderRadius: radius.md,
            padding: spacing.lg,
            borderWidth: 1,
            borderColor: theme.border,
            marginBottom: spacing.lg,
            ...shadow.card,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: theme.successSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="home" size={22} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '800' }}>Home</Text>
            <Text style={{ color: theme.muted, fontSize: 13, marginTop: 4 }}>
              {location.line1}, {location.city}
            </Text>
            {location.phone ? (
              <Text style={{ color: theme.muted, fontSize: 13, marginTop: 4 }}>{location.phone}</Text>
            ) : null}
          </View>
        </View>

        <Text style={{ fontWeight: '800', fontSize: 16, marginBottom: spacing.md }}>Delivery Time</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg }}>
          {timeSlots.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => setSlot(s.id)}
              style={{
                width: 110,
                marginRight: spacing.sm,
                padding: spacing.md,
                borderRadius: radius.md,
                borderWidth: 2,
                borderColor: slot === s.id ? theme.primary : theme.border,
                backgroundColor: slot === s.id ? theme.successSoft : theme.surface,
                alignItems: 'center',
              }}
            >
              <Ionicons
                name={(s.icon ?? 'time-outline') as keyof typeof Ionicons.glyphMap}
                size={24}
                color={slot === s.id ? theme.primary : theme.muted}
              />
              <Text style={{ fontWeight: '700', marginTop: 6 }}>{text(s.title)}</Text>
              <Text style={{ fontSize: 10, color: theme.muted, marginTop: 2 }}>{text(s.subtitle)}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={{ fontWeight: '800', fontSize: 16, marginBottom: spacing.md }}>Payment</Text>
        <View style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
          {PAYMENT_OPTIONS.map((option) => {
            const selected = paymentMethod === option.id;
            return (
              <Pressable
                key={option.id}
                onPress={() => setPaymentMethod(option.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  backgroundColor: theme.surface,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  borderWidth: 2,
                  borderColor: selected ? theme.primary : theme.border,
                  ...shadow.card,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: selected ? theme.successSoft : theme.neutralSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name={option.icon} size={22} color={selected ? theme.primary : theme.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '800', color: theme.text }}>{option.title}</Text>
                  <Text style={{ color: theme.muted, fontSize: 12, marginTop: 2 }}>{option.subtitle}</Text>
                </View>
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    borderWidth: 2,
                    borderColor: selected ? theme.primary : theme.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {selected ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: theme.primary }} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text style={{ fontWeight: '800', fontSize: 16, marginBottom: spacing.md }}>Order Summary</Text>
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: radius.md,
            padding: spacing.lg,
            borderWidth: 1,
            borderColor: theme.border,
            ...shadow.card,
          }}
        >
          {cart.data.lines.map((line, i) => (
            <View
              key={i}
              style={{
                flexDirection: 'row',
                gap: spacing.md,
                marginBottom: i < cart.data.lines.length - 1 ? spacing.md : 0,
                paddingBottom: i < cart.data.lines.length - 1 ? spacing.md : 0,
                borderBottomWidth: i < cart.data.lines.length - 1 ? 1 : 0,
                borderBottomColor: theme.border,
              }}
            >
              {line.imageUrl ? (
                <Image source={{ uri: line.imageUrl }} style={{ width: 48, height: 48, borderRadius: 8 }} />
              ) : (
                <View style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: theme.border }} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600' }}>{line.productName.en}</Text>
                <Text style={{ color: theme.muted, fontSize: 12 }}>
                  {line.quantity} Units · {formatMoney(currency, line.unitPrice)}
                </Text>
              </View>
              <Text style={{ fontWeight: '800', color: theme.primary }}>{formatMoney(currency, line.lineTotal)}</Text>
            </View>
          ))}
          <View style={{ height: 1, backgroundColor: theme.border, marginVertical: spacing.md }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ color: theme.muted }}>Subtotal</Text>
            <Text style={{ fontWeight: '600' }}>{formatMoney(currency, cart.data.subtotal)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.muted }}>Delivery Fee</Text>
            <Text style={{ fontWeight: '800', color: theme.success }}>{deliveryFree ? 'FREE' : formatMoney(currency, cart.data.shippingTotal)}</Text>
          </View>
        </View>
        {error ? <Text style={{ color: theme.discount, marginTop: spacing.md }}>{error}</Text> : null}
      </ScrollView>

      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: insets.bottom + spacing.lg,
          backgroundColor: theme.surface,
          borderTopWidth: 1,
          borderTopColor: theme.border,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
          <View>
            <Text style={{ fontSize: 11, color: theme.muted, fontWeight: '600' }}>FINAL AMOUNT</Text>
            <Text style={{ fontWeight: '800', fontSize: 22 }}>{formatMoney(currency, cart.data.grandTotal)}</Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: theme.successSoft,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: radius.full,
            }}
          >
            <Ionicons name="lock-closed" size={12} color={theme.success} />
            <Text style={{ color: theme.success, fontWeight: '700', fontSize: 11 }}>SECURE</Text>
          </View>
        </View>
        <Pressable
          onPress={placeOrder}
          disabled={loading}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: theme.primaryDark,
            paddingVertical: 16,
            borderRadius: radius.md,
            opacity: loading ? 0.7 : 1,
          }}
        >
          <Text style={{ color: 'white', fontWeight: '800', fontSize: 16 }}>{loading ? 'Placing…' : 'Place Order'}</Text>
          <Ionicons name="arrow-forward" size={20} color="white" />
        </Pressable>
      </View>
    </View>
  );
}
