import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
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
import { apiRequest } from '../../lib/api';
import { openLogin } from '../../lib/openLogin';
import { useAuthSession } from '../../lib/useAuthSession';
import { formatMoney } from '../../lib/format';
import { theme, spacing, radius } from '../../lib/theme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAppLocation } from '../../lib/usePublicConfig';
import { useDeliveryAddress } from '../../lib/useDeliveryAddress';

type CartLine = {
  vendorId: string;
  vendorName?: string;
  variantId: string;
  productName: { en: string };
  imageUrl?: string;
  quantity: number;
  unitPrice: number;
  mrp?: number;
  lineTotal: number;
};

type CartCalc = {
  grandTotal: number;
  subtotal: number;
  shippingTotal: number;
  discountTotal?: number;
  lines: CartLine[];
  insights?: Array<
    | { type: 'FREE_DELIVERY_GAP'; amountRemaining: number; currency: string }
    | { type: 'MULTI_VENDOR'; vendorCount: number }
    | { type: 'SAVINGS'; amount: number; currency: string }
  >;
};

const CART_RETURN = '/(tabs)/cart';
const IMG = 48;

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { hasToken } = useAuthSession();
  const location = useAppLocation();
  const { hasSavedAddress } = useDeliveryAddress();

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
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['mobile-cart'] });
    },
  });

  const lines = cart.data?.lines ?? [];
  const itemCount = lines.reduce((s, l) => s + l.quantity, 0);
  const isEmpty = !cart.isLoading && cart.data && lines.length === 0;

  const vendorGroups = useMemo(() => {
    const map = new Map<string, { vendorId: string; vendorName: string; lines: CartLine[] }>();
    for (const line of lines) {
      const existing = map.get(line.vendorId);
      if (existing) {
        existing.lines.push(line);
      } else {
        map.set(line.vendorId, {
          vendorId: line.vendorId,
          vendorName: line.vendorName?.trim() || 'Restaurant',
          lines: [line],
        });
      }
    }
    return [...map.values()];
  }, [lines]);

  const savingsInsight = cart.data?.insights?.find((i) => i.type === 'SAVINGS');
  const freeDeliveryInsight = cart.data?.insights?.find((i) => i.type === 'FREE_DELIVERY_GAP');
  const savingsAmount =
    savingsInsight?.type === 'SAVINGS'
      ? savingsInsight.amount
      : lines.reduce((s, l) => s + Math.max(0, (l.mrp ?? l.unitPrice) - l.unitPrice) * l.quantity, 0);

  function lineKey(line: Pick<CartLine, 'vendorId' | 'variantId'>) {
    return `${line.vendorId}:${line.variantId}`;
  }

  const pendingVars = updateQty.isPending ? updateQty.variables : undefined;
  const pendingLineKey = pendingVars ? lineKey(pendingVars) : null;
  const pendingIsRemove = pendingVars?.quantity === 0;

  function setQty(line: CartLine, quantity: number) {
    if (pendingLineKey === lineKey(line)) return;
    updateQty.mutate({
      variantId: line.variantId,
      vendorId: line.vendorId,
      quantity,
    });
  }

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
        <ScreenHeader title="Cart" showBack layout="centered" />
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: spacing.xl,
          }}
        >
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: theme.white,
              borderWidth: 1,
              borderColor: theme.border,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: spacing.md,
            }}
          >
            <Ionicons name="bag-handle-outline" size={28} color={theme.muted} />
          </View>
          <Text style={{ fontWeight: '800', fontSize: 18, color: theme.text, letterSpacing: -0.3 }}>
            Your cart is empty
          </Text>
          <Text
            style={{
              color: theme.muted,
              textAlign: 'center',
              marginTop: 6,
              lineHeight: 19,
              fontSize: 13,
              maxWidth: 240,
            }}
          >
            Add dishes from a restaurant and they will show up here.
          </Text>
          <Pressable
            onPress={() => router.push('/restaurants')}
            style={{
              marginTop: spacing.lg,
              backgroundColor: theme.bannerBg,
              paddingHorizontal: 22,
              paddingVertical: 11,
              borderRadius: radius.sm,
            }}
          >
            <Text style={{ color: theme.white, fontWeight: '700', fontSize: 13 }}>Browse restaurants</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const deliveryFree = cart.data.shippingTotal === 0;
  const footerPad = Math.max(insets.bottom, 8) + spacing.md;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScreenHeader
        title="Cart"
        showBack
        layout="centered"
        right={
          <Text style={{ fontSize: 11, fontWeight: '600', color: theme.onHeaderMuted }}>
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </Text>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: 88 + footerPad,
          gap: spacing.sm,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: theme.white,
            borderRadius: radius.sm,
            borderWidth: 1,
            borderColor: theme.border,
            paddingVertical: 8,
            paddingHorizontal: 10,
          }}
        >
          <Ionicons name="location-sharp" size={16} color={theme.primary} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: theme.muted, letterSpacing: 0.2 }}>
              DELIVERY TO
            </Text>
            <Text
              numberOfLines={1}
              style={{ fontSize: 12, fontWeight: '700', color: theme.text, marginTop: 1 }}
            >
              {hasSavedAddress ? location.label || location.city : 'No address saved'}
            </Text>
            <Text numberOfLines={1} style={{ fontSize: 11, color: theme.muted, marginTop: 1 }}>
              {hasSavedAddress
                ? [location.line1, location.city].filter(Boolean).join(', ')
                : 'Add an address for accurate delivery'}
            </Text>
          </View>
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/login-address',
                params: { returnTo: CART_RETURN },
              })
            }
            hitSlop={6}
            style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '800', color: theme.primary }}>
              {hasSavedAddress ? 'Change' : 'Add'}
            </Text>
          </Pressable>
        </View>

        {vendorGroups.map((group) => (
          <View key={group.vendorId} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 2 }}>
              <Ionicons name="storefront-outline" size={14} color={theme.primary} />
              <Text
                style={{ flex: 1, fontSize: 12, fontWeight: '700', color: theme.text }}
                numberOfLines={1}
              >
                {group.vendorName}
              </Text>
            </View>

            <View
              style={{
                backgroundColor: theme.white,
                borderRadius: radius.sm,
                borderWidth: 1,
                borderColor: theme.border,
                overflow: 'hidden',
              }}
            >
              {group.lines.map((line, index) => {
                const unitStrike =
                  line.mrp != null && line.mrp > line.unitPrice ? line.mrp : undefined;
                const lineBusy = pendingLineKey === lineKey(line);
                const removing = lineBusy && pendingIsRemove;
                const qtyBusy = lineBusy && !pendingIsRemove;
                return (
                  <View
                    key={`${line.vendorId}-${line.variantId}`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      gap: 10,
                      paddingVertical: 8,
                      paddingLeft: 10,
                      paddingRight: 8,
                      borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
                      borderTopColor: theme.border,
                    }}
                  >
                    <View
                      style={{
                        width: IMG,
                        height: IMG,
                        borderRadius: 6,
                        backgroundColor: theme.neutralSoft,
                        overflow: 'hidden',
                        marginTop: 1,
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

                    <View style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                        <Text
                          numberOfLines={2}
                          style={{
                            flex: 1,
                            fontWeight: '700',
                            fontSize: 12,
                            lineHeight: 16,
                            color: theme.text,
                          }}
                        >
                          {line.productName.en}
                        </Text>
                        <Pressable
                          disabled={lineBusy}
                          onPress={() => setQty(line, 0)}
                          hitSlop={8}
                          accessibilityLabel="Remove item"
                          style={{
                            width: 22,
                            height: 22,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {removing ? (
                            <ActivityIndicator size="small" color={theme.muted} />
                          ) : (
                            <Ionicons name="close" size={16} color={theme.muted} />
                          )}
                        </Pressable>
                      </View>

                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginTop: 6,
                          gap: 8,
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              borderWidth: 1,
                              borderColor: theme.primary,
                              borderRadius: 6,
                              overflow: 'hidden',
                              minWidth: 74,
                              justifyContent: 'center',
                            }}
                          >
                            {qtyBusy ? (
                              <View
                                style={{
                                  height: 24,
                                  minWidth: 74,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <ActivityIndicator size="small" color={theme.primary} />
                              </View>
                            ) : (
                              <>
                                <Pressable
                                  disabled={removing || line.quantity <= 1}
                                  onPress={() => setQty(line, line.quantity - 1)}
                                  style={{
                                    width: 26,
                                    height: 24,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    opacity: removing || line.quantity <= 1 ? 0.35 : 1,
                                  }}
                                  accessibilityLabel="Decrease quantity"
                                >
                                  <Text style={{ fontWeight: '700', fontSize: 14, color: theme.primary }}>−</Text>
                                </Pressable>
                                <Text
                                  style={{
                                    minWidth: 22,
                                    textAlign: 'center',
                                    fontWeight: '800',
                                    fontSize: 12,
                                    color: theme.text,
                                  }}
                                >
                                  {line.quantity}
                                </Text>
                                <Pressable
                                  disabled={removing}
                                  onPress={() => setQty(line, line.quantity + 1)}
                                  style={{
                                    width: 26,
                                    height: 24,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    opacity: removing ? 0.35 : 1,
                                  }}
                                  accessibilityLabel="Increase quantity"
                                >
                                  <Text style={{ fontWeight: '700', fontSize: 14, color: theme.primary }}>+</Text>
                                </Pressable>
                              </>
                            )}
                          </View>

                          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                            <Text style={{ fontWeight: '700', fontSize: 11, color: theme.muted }}>
                              {formatMoney(currency, line.unitPrice)}
                            </Text>
                            {unitStrike != null ? (
                              <Text
                                style={{
                                  fontSize: 10,
                                  color: theme.muted,
                                  textDecorationLine: 'line-through',
                                  opacity: 0.7,
                                }}
                              >
                                {formatMoney(currency, unitStrike)}
                              </Text>
                            ) : null}
                          </View>
                        </View>

                        <Text
                          style={{
                            fontWeight: '800',
                            fontSize: 12,
                            color: theme.text,
                            minWidth: 52,
                            textAlign: 'right',
                          }}
                        >
                          {formatMoney(currency, line.lineTotal)}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ))}

        {freeDeliveryInsight?.type === 'FREE_DELIVERY_GAP' ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 10,
              paddingVertical: 8,
              backgroundColor: theme.white,
              borderRadius: radius.sm,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <Ionicons name="bicycle-outline" size={14} color={theme.delivery} />
            <Text style={{ flex: 1, fontSize: 11, color: theme.muted, lineHeight: 15 }}>
              Add {formatMoney(currency, freeDeliveryInsight.amountRemaining)} more for free delivery
            </Text>
          </View>
        ) : null}

        <View
          style={{
            backgroundColor: theme.white,
            borderRadius: radius.sm,
            borderWidth: 1,
            borderColor: theme.border,
            paddingHorizontal: 12,
            paddingTop: 10,
            paddingBottom: 10,
          }}
        >
          <Text
            style={{
              fontWeight: '800',
              fontSize: 12,
              color: theme.text,
              letterSpacing: 0.2,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Bill details
          </Text>

          <BillRow label="Item total" value={formatMoney(currency, cart.data.subtotal)} />
          <BillRow
            label="Delivery fee"
            value={deliveryFree ? 'FREE' : formatMoney(currency, cart.data.shippingTotal)}
            valueColor={deliveryFree ? theme.success : theme.text}
          />
          {savingsAmount > 0 ? (
            <BillRow
              label="Item discount"
              value={`−${formatMoney(currency, savingsAmount)}`}
              valueColor={theme.success}
            />
          ) : null}

          <View
            style={{
              height: StyleSheet.hairlineWidth,
              backgroundColor: theme.border,
              marginTop: 8,
              marginBottom: 8,
            }}
          />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontWeight: '800', fontSize: 13, color: theme.text }}>To pay</Text>
            <Text style={{ fontWeight: '800', fontSize: 14, color: theme.text }}>
              {formatMoney(currency, cart.data.grandTotal)}
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
          backgroundColor: theme.tabBarBg,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.tabBarBorder,
          paddingHorizontal: spacing.lg,
          paddingTop: 8,
          paddingBottom: footerPad,
        }}
      >
        <Pressable
          onPress={() => router.push('/checkout')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            backgroundColor: theme.bannerBg,
            paddingVertical: 13,
            borderRadius: radius.sm,
          }}
        >
          <Text style={{ color: theme.white, fontWeight: '700', fontSize: 14 }}>Checkout</Text>
          <Ionicons name="arrow-forward" size={16} color={theme.white} />
        </Pressable>
      </View>
    </View>
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
