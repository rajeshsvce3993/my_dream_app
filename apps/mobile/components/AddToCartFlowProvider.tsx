import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useCartFeedback } from '../lib/cartFeedback';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { addCartItem, ensureSignedInForCart, SignInRequiredError } from '../lib/addToCart';
import { fetchAddToCartFlow, type AddToCartFlowResult, type AddToCartFlowVendor } from '../lib/addToCartFlowApi';
import { confirmSingleRestaurantCart, isCartOtherRestaurantError, promptReplaceAfterConflict } from '../lib/singleRestaurantCart';
import { VendorOfferCompareCard } from './VendorOfferCompareCard';
import { clearPendingAddToCart, savePendingAddToCart } from '../lib/pendingAddToCart';
import { theme, spacing, radius } from '../lib/theme';
import { useDeliveryAddress } from '../lib/useDeliveryAddress';

type StartAddInput = {
  productId: string;
  variantId?: string;
  quantity?: number;
  productName?: string;
  /** When adding from a vendor store screen, that store’s row shows “Continue”. */
  contextVendorId?: string;
  /** Restaurant / store display name (for cart-replace message). */
  contextVendorName?: string;
  /** Dish-offer rows already show each restaurant’s price — skip compare sheet. */
  skipVendorCompare?: boolean;
};

type CompareFlowState = AddToCartFlowResult & { contextVendorId?: string };

type FlowContextValue = {
  /** Returns true when the item was added to the cart. */
  startAddToCart: (input: StartAddInput) => Promise<boolean>;
  isPending: boolean;
  /** When vendorId is passed, only that restaurant row shows the loader. */
  isAddingProduct: (productId: string, vendorId?: string) => boolean;
};

const FlowContext = createContext<FlowContextValue | null>(null);

function addInFlightKey(productId: string, vendorId?: string) {
  return vendorId ? `${productId}:${vendorId}` : productId;
}

export function useAddToCartFlow(): FlowContextValue {
  const ctx = useContext(FlowContext);
  if (!ctx) throw new Error('useAddToCartFlow must be used within AddToCartFlowProvider');
  return ctx;
}

export function AddToCartFlowProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { location, hasSavedAddress } = useDeliveryAddress();
  const { notifyItemAdded } = useCartFeedback();
  const [compareFlow, setCompareFlow] = useState<CompareFlowState | null>(null);
  const [activeAddKey, setActiveAddKey] = useState<string | null>(null);
  const addMetaRef = useRef<{ productId: string; productName?: string } | null>(null);

  const commitAdd = useMutation({
    mutationFn: async (input: {
      productId: string;
      variantId: string;
      vendorId?: string;
      vendorName?: string;
      vendorProductId?: string;
      quantity: number;
      deferAvailability?: boolean;
      replaceCart?: boolean;
    }) => {
      if (!location) throw new Error('Delivery location required');

      let replaceCart = Boolean(input.replaceCart);

      if (input.vendorId && !replaceCart) {
        const confirm = await confirmSingleRestaurantCart({
          vendorId: input.vendorId,
          vendorName: input.vendorName,
        });
        if (!confirm.ok) {
          const err = new Error('CART_REPLACE_CANCELLED');
          err.name = 'CartReplaceCancelled';
          throw err;
        }
        replaceCart = Boolean(confirm.replaceCart);
      }

      try {
        await addCartItem({
          vendorId: input.vendorId,
          productId: input.productId,
          variantId: input.variantId,
          quantity: input.quantity,
          location,
          vendorProductId: input.vendorProductId,
          deferAvailability: input.deferAvailability,
          replaceCart,
        });
      } catch (err) {
        if (!input.vendorId || !isCartOtherRestaurantError(err)) throw err;
        const replace = await promptReplaceAfterConflict({ vendorName: input.vendorName });
        if (!replace) {
          const cancel = new Error('CART_REPLACE_CANCELLED');
          cancel.name = 'CartReplaceCancelled';
          throw cancel;
        }
        await addCartItem({
          vendorId: input.vendorId,
          productId: input.productId,
          variantId: input.variantId,
          quantity: input.quantity,
          location,
          vendorProductId: input.vendorProductId,
          deferAvailability: input.deferAvailability,
          replaceCart: true,
        });
      }
    },
    onSuccess: () => {
      if (addMetaRef.current) notifyItemAdded(addMetaRef.current);
      qc.invalidateQueries({ queryKey: ['mobile-cart'] });
      setCompareFlow(null);
      setActiveAddKey(null);
    },
    onError: (err) => {
      setActiveAddKey(null);
      if (err instanceof Error && err.name === 'CartReplaceCancelled') return;
      /* availability is not blocked on add; checkout validates */
    },
  });

  const addLockRef = useRef<Promise<unknown> | null>(null);

  const runFlow = useCallback(
    async (input: StartAddInput): Promise<boolean> => {
      // Serialize adds so two top-pick taps can't both see an empty cart.
      const previous = addLockRef.current;
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      addLockRef.current = gate;
      if (previous) await previous.catch(() => undefined);

      try {
      addMetaRef.current = {
        productId: input.productId,
        productName: input.productName,
      };
      setActiveAddKey(addInFlightKey(input.productId, input.contextVendorId));
      try {
        await ensureSignedInForCart();
      } catch (e) {
        if (e instanceof SignInRequiredError) {
          setActiveAddKey(null);
          return false;
        }
        setActiveAddKey(null);
        throw e;
      }

      const safeCommit = async (
        payload: Parameters<typeof commitAdd.mutateAsync>[0],
      ): Promise<boolean> => {
        try {
          await commitAdd.mutateAsync(payload);
          return true;
        } catch (e) {
          setActiveAddKey(null);
          if (e instanceof Error && e.name === 'CartReplaceCancelled') return false;
          const msg = e instanceof Error ? e.message : '';
          if (msg.includes('not available for delivery')) return false;
          throw e;
        }
      };

      if (!hasSavedAddress || !location) {
        await savePendingAddToCart({
          productId: input.productId,
          variantId: input.variantId,
          quantity: input.quantity ?? 1,
        });
        setActiveAddKey(null);
        router.push('/login-address');
        return false;
      }

      const flow = await fetchAddToCartFlow({
        productId: input.productId,
        variantId: input.variantId,
        quantity: input.quantity ?? 1,
        lng: location.lng,
        lat: location.lat,
        hasDeliveryAddress: true,
        contextVendorId: input.contextVendorId,
      });

      // Outside service area: do not add (see Stores tab for messaging).
      if (flow.status === 'OUTSIDE_SERVICE_AREA') {
        setActiveAddKey(null);
        return false;
      }

      // In service area but no store offers this SKU — add anyway (availability checked at checkout).
      if (flow.status === 'NO_VENDORS') {
        return safeCommit({
          productId: flow.productId,
          variantId: flow.variantId,
          quantity: flow.quantity,
          deferAvailability: true,
        });
      }

      if (flow.status === 'SELECT_VENDOR') {
        // Prefer exact restaurant — never fall back to a different store.
        const pickExactVendor = (vendorId: string | null | undefined) => {
          if (!vendorId) return undefined;
          return (
            flow.vendors.find((v) => v.vendorId === vendorId) ??
            (flow.referenceVendor?.vendorId === vendorId ? flow.referenceVendor : undefined)
          );
        };

        // Per-restaurant offer rows already show price — add THAT store only.
        if (input.skipVendorCompare && input.contextVendorId) {
          const v = pickExactVendor(input.contextVendorId);
          return safeCommit({
            productId: flow.productId,
            variantId: flow.variantId,
            vendorId: input.contextVendorId,
            vendorName: v?.vendorName ?? input.contextVendorName,
            vendorProductId: v?.vendorProductId,
            quantity: flow.quantity,
          });
        }

        const shouldCompare =
          flow.showVendorCompare === true ||
          (flow.showVendorCompare === undefined && flow.vendors.length > 1);

        if (shouldCompare && flow.vendors.length > 1) {
          setCompareFlow({ ...flow, contextVendorId: input.contextVendorId });
          setActiveAddKey(null);
          return false;
        }

        const autoId = flow.autoVendorId ?? flow.recommendedVendorId;
        const v = pickExactVendor(autoId) ?? flow.vendors[0];
        if (!v) {
          setActiveAddKey(null);
          return false;
        }
        return safeCommit({
          productId: flow.productId,
          variantId: flow.variantId,
          vendorId: v.vendorId,
          vendorName: v.vendorName ?? input.contextVendorName,
          vendorProductId: v.vendorProductId,
          quantity: flow.quantity,
        });
      }

      return safeCommit({
        productId: flow.productId,
        variantId: flow.variantId,
        quantity: flow.quantity,
        deferAvailability: true,
      });
      } finally {
        release();
        if (addLockRef.current === gate) addLockRef.current = null;
      }
    },
    [commitAdd, hasSavedAddress, location, notifyItemAdded],
  );

  const isAddingProduct = useCallback(
    (productId: string, vendorId?: string) =>
      activeAddKey === addInFlightKey(productId, vendorId),
    [activeAddKey],
  );

  const startAddToCart = useCallback(
    async (input: StartAddInput) => runFlow(input),
    [runFlow],
  );

  const value = useMemo(
    () => ({
      startAddToCart,
      isPending: commitAdd.isPending || activeAddKey != null,
      isAddingProduct,
    }),
    [activeAddKey, commitAdd.isPending, isAddingProduct, startAddToCart],
  );

  return (
    <FlowContext.Provider value={value}>
      {children}
      <CompareStoresModal
        flow={compareFlow}
        loading={commitAdd.isPending}
        onClose={() => setCompareFlow(null)}
        onSelect={(v) => {
          if (!compareFlow) return;
          addMetaRef.current = { productId: compareFlow.productId };
          setActiveAddKey(addInFlightKey(compareFlow.productId, v.vendorId));
          commitAdd.mutate({
            productId: compareFlow.productId,
            variantId: compareFlow.variantId,
            vendorId: v.vendorId,
            vendorName: v.vendorName,
            vendorProductId: v.vendorProductId,
            quantity: compareFlow.quantity,
          });
        }}
      />
    </FlowContext.Provider>
  );
}

function CompareStoresModal({
  flow,
  loading,
  onClose,
  onSelect,
}: {
  flow: CompareFlowState | null;
  loading: boolean;
  onClose: () => void;
  onSelect: (v: AddToCartFlowVendor) => void;
}) {
  const referenceVendor = flow?.referenceVendor;
  const vendors = flow?.vendors ?? [];
  const isChoose = flow?.compareMode === 'choose' || (!referenceVendor && vendors.length > 0);
  const title = isChoose ? 'Choose restaurant' : 'Better price nearby?';
  const subtitle = isChoose
    ? 'This dish is available at more than one restaurant near you.'
    : referenceVendor
      ? `${referenceVendor.vendorName} — ₹${referenceVendor.finalUnitPrice.toFixed(0)}. Other restaurants are cheaper:`
      : 'Pick a restaurant below';

  return (
    <Modal visible={Boolean(flow)} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <View
          style={{
            maxHeight: '80%',
            backgroundColor: theme.bg,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            padding: spacing.lg,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '800', marginBottom: spacing.xs, color: theme.text }}>
            {title}
          </Text>
          <Text style={{ color: theme.muted, marginBottom: spacing.md, lineHeight: 20, fontSize: 13 }}>
            {subtitle}
          </Text>
          <ScrollView>
            {vendors.map((v, index) => (
              <VendorOfferCompareCard
                key={v.vendorId}
                actualPrice={flow?.actualPrice}
                vendor={{
                  vendorId: v.vendorId,
                  vendorName: v.vendorName,
                  vendorPrice: v.vendorPrice,
                  sellingPrice: v.sellingPrice,
                  finalUnitPrice: v.finalUnitPrice,
                  discountPercent: v.discountPercent,
                  distanceKm: v.distanceKm,
                  rating: v.rating,
                  deliveryEstimateMinutes: v.deliveryEstimateMinutes,
                  tag: isChoose ? (index === 0 ? 'BEST PRICE' : undefined) : 'LOWER PRICE',
                  footer: (
                    <Pressable
                      disabled={loading}
                      onPress={() => onSelect(v)}
                      style={{
                        marginTop: spacing.sm,
                        backgroundColor: theme.primary,
                        padding: 10,
                        borderRadius: 8,
                        opacity: loading ? 0.6 : 1,
                      }}
                    >
                      <Text style={{ color: 'white', textAlign: 'center', fontWeight: '700' }}>
                        {isChoose ? 'Add from here' : 'Select store'}
                      </Text>
                    </Pressable>
                  ),
                }}
              />
            ))}
          </ScrollView>
          {referenceVendor && !isChoose ? (
            <Pressable
              disabled={loading}
              onPress={() => onSelect(referenceVendor)}
              style={{
                marginTop: spacing.sm,
                borderWidth: 1.5,
                borderColor: theme.primary,
                padding: 12,
                borderRadius: 8,
                opacity: loading ? 0.6 : 1,
              }}
            >
              <Text style={{ textAlign: 'center', color: theme.primary, fontWeight: '800' }}>
                Keep {referenceVendor.vendorName}
              </Text>
            </Pressable>
          ) : null}
          <Pressable onPress={onClose} style={{ marginTop: spacing.md, padding: 12 }}>
            <Text style={{ textAlign: 'center', color: theme.muted, fontWeight: '600' }}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

