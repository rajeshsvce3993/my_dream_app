import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiRequest } from '../lib/api';
import { text } from '../lib/locale';
import { useAppLocation } from '../lib/usePublicConfig';
import { useDeliveryAddress } from '../lib/useDeliveryAddress';
import { formatMoney } from '../lib/format';
import { theme, spacing, radius } from '../lib/theme';
import { useCartFeedback } from '../lib/cartFeedback';
import { ScreenHeader } from '../components/ScreenHeader';

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
    vendorName?: string;
  }>;
};

type DeliverySlotConfig = {
  id: string;
  icon?: string;
  title: { en: string };
  subtitle: { en: string };
};

const DEFAULT_SLOTS: DeliverySlotConfig[] = [
  { id: 'instant', icon: 'flash', title: { en: 'Instant' }, subtitle: { en: '10 mins' } },
  { id: 'standard', icon: 'time-outline', title: { en: 'Standard' }, subtitle: { en: '30–40 mins' } },
  { id: 'scheduled', icon: 'calendar-outline', title: { en: 'Schedule' }, subtitle: { en: 'Pick a time' } },
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

const CHECKOUT_RETURN = '/checkout';

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
  const { hasSavedAddress } = useDeliveryAddress();
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
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: theme.bg }}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  const deliveryFree = cart.data.shippingTotal === 0;
  const footerPad = Math.max(insets.bottom, 8) + spacing.md;
  const itemCount = cart.data.lines.reduce((s, l) => s + l.quantity, 0);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScreenHeader title="Checkout" showBack layout="centered" />

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: 88 + footerPad,
          gap: spacing.sm,
        }}
      >
        {/* Delivery to */}
        <SectionLabel>Delivery to</SectionLabel>
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: theme.neutralSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="location-sharp" size={16} color={theme.primary} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: theme.text }} numberOfLines={1}>
                {hasSavedAddress ? location.label || 'Home' : 'No address saved'}
              </Text>
              <Text style={{ fontSize: 12, color: theme.muted, marginTop: 2, lineHeight: 16 }} numberOfLines={2}>
                {hasSavedAddress
                  ? [location.line1, location.city].filter(Boolean).join(', ')
                  : 'Add an address to place your order'}
              </Text>
              {hasSavedAddress && location.phone ? (
                <Text style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>{location.phone}</Text>
              ) : null}
            </View>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/login-address',
                  params: { returnTo: CHECKOUT_RETURN },
                })
              }
              hitSlop={6}
            >
              <Text style={{ fontSize: 12, fontWeight: '800', color: theme.primary }}>
                {hasSavedAddress ? 'Change' : 'Add'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Delivery time */}
        <SectionLabel>Delivery time</SectionLabel>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {timeSlots.map((s) => {
            const selected = slot === s.id;
            return (
              <Pressable
                key={s.id}
                onPress={() => setSlot(s.id)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  paddingHorizontal: 8,
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  borderColor: selected ? theme.bannerBg : theme.border,
                  backgroundColor: selected ? theme.bannerBg : theme.white,
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Ionicons
                  name={(s.icon ?? 'time-outline') as keyof typeof Ionicons.glyphMap}
                  size={18}
                  color={selected ? theme.white : theme.muted}
                />
                <Text
                  style={{
                    fontWeight: '700',
                    fontSize: 12,
                    color: selected ? theme.white : theme.text,
                  }}
                  numberOfLines={1}
                >
                  {text(s.title)}
                </Text>
                <Text
                  style={{
                    fontSize: 10,
                    color: selected ? 'rgba(255,255,255,0.85)' : theme.muted,
                  }}
                  numberOfLines={1}
                >
                  {text(s.subtitle)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Payment */}
        <SectionLabel>Payment</SectionLabel>
        <View style={[styles.card, { paddingVertical: 0, paddingHorizontal: 0, overflow: 'hidden' }]}>
          {PAYMENT_OPTIONS.map((option, index) => {
            const selected = paymentMethod === option.id;
            return (
              <Pressable
                key={option.id}
                onPress={() => setPaymentMethod(option.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
                  borderTopColor: theme.border,
                  backgroundColor: selected ? theme.primaryMuted : theme.white,
                }}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    backgroundColor: selected ? theme.white : theme.neutralSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name={option.icon} size={18} color={selected ? theme.primary : theme.muted} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontWeight: '700', fontSize: 13, color: theme.text }}>{option.title}</Text>
                  <Text style={{ color: theme.muted, fontSize: 11, marginTop: 1 }}>{option.subtitle}</Text>
                </View>
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    borderWidth: 1.5,
                    borderColor: selected ? theme.bannerBg : theme.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {selected ? (
                    <View
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: 5,
                        backgroundColor: theme.bannerBg,
                      }}
                    />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Order items */}
        <SectionLabel>
          Order · {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </SectionLabel>
        <View style={[styles.card, { paddingVertical: 0, paddingHorizontal: 0, overflow: 'hidden' }]}>
          {cart.data.lines.map((line, i) => (
            <View
              key={`${line.productName.en}-${i}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                borderTopColor: theme.border,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 6,
                  backgroundColor: theme.neutralSoft,
                  overflow: 'hidden',
                }}
              >
                {line.imageUrl ? (
                  <Image
                    source={{ uri: line.imageUrl }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                ) : null}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontWeight: '700', fontSize: 12, color: theme.text }} numberOfLines={1}>
                  {line.productName.en}
                </Text>
                <Text style={{ color: theme.muted, fontSize: 11, marginTop: 1 }}>
                  Qty {line.quantity} · {formatMoney(currency, line.unitPrice)}
                </Text>
              </View>
              <Text style={{ fontWeight: '800', fontSize: 12, color: theme.text }}>
                {formatMoney(currency, line.lineTotal)}
              </Text>
            </View>
          ))}
        </View>

        {/* Bill */}
        <SectionLabel>Bill details</SectionLabel>
        <View style={styles.card}>
          <BillRow label="Item total" value={formatMoney(currency, cart.data.subtotal)} />
          <BillRow
            label="Delivery fee"
            value={deliveryFree ? 'FREE' : formatMoney(currency, cart.data.shippingTotal)}
            valueColor={deliveryFree ? theme.success : theme.text}
          />
          <View
            style={{
              height: StyleSheet.hairlineWidth,
              backgroundColor: theme.border,
              marginVertical: 8,
            }}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontWeight: '800', fontSize: 13, color: theme.text }}>To pay</Text>
            <Text style={{ fontWeight: '800', fontSize: 14, color: theme.text }}>
              {formatMoney(currency, cart.data.grandTotal)}
            </Text>
          </View>
        </View>

        {error ? (
          <Text style={{ color: theme.discount, fontSize: 12, fontWeight: '600' }}>{error}</Text>
        ) : null}
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: theme.tabBarBg,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.tabBarBorder,
          paddingHorizontal: spacing.lg,
          paddingTop: 8,
          paddingBottom: footerPad,
        }}
      >
        <Pressable
          onPress={placeOrder}
          disabled={loading}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: theme.bannerBg,
            paddingVertical: 13,
            borderRadius: radius.sm,
            opacity: loading ? 0.75 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator size="small" color={theme.white} />
          ) : (
            <>
              <Text style={{ color: theme.white, fontWeight: '700', fontSize: 14 }}>
                Place order · {formatMoney(currency, cart.data.grandTotal)}
              </Text>
              <Ionicons name="arrow-forward" size={16} color={theme.white} />
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: '800',
        color: theme.muted,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        marginTop: 4,
        marginBottom: 2,
        paddingHorizontal: 2,
      }}
    >
      {children}
    </Text>
  );
}

function BillRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 3,
      }}
    >
      <Text style={{ fontSize: 12, color: theme.muted }}>{label}</Text>
      <Text style={{ fontSize: 12, fontWeight: '700', color: valueColor ?? theme.text }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.white,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
