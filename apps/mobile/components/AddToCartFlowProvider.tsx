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
};

type CompareFlowState = AddToCartFlowResult & { contextVendorId?: string };

type FlowContextValue = {
  startAddToCart: (input: StartAddInput) => Promise<void>;
  isPending: boolean;
  isAddingProduct: (productId: string) => boolean;
};

const FlowContext = createContext<FlowContextValue | null>(null);

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
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const addMetaRef = useRef<{ productId: string; productName?: string } | null>(null);

  const commitAdd = useMutation({
    mutationFn: async (input: {
      productId: string;
      variantId: string;
      vendorId?: string;
      vendorProductId?: string;
      quantity: number;
      deferAvailability?: boolean;
    }) => {
      if (!location) throw new Error('Delivery location required');
      await addCartItem({
        vendorId: input.vendorId,
        productId: input.productId,
        variantId: input.variantId,
        quantity: input.quantity,
        location,
        vendorProductId: input.vendorProductId,
        deferAvailability: input.deferAvailability,
      });
    },
    onSuccess: () => {
      if (addMetaRef.current) notifyItemAdded(addMetaRef.current);
      qc.invalidateQueries({ queryKey: ['mobile-cart'] });
      setCompareFlow(null);
      setActiveProductId(null);
    },
    onError: () => {
      setActiveProductId(null);
      /* availability is not blocked on add; checkout validates */
    },
  });

  const runFlow = useCallback(
    async (input: StartAddInput) => {
      addMetaRef.current = {
        productId: input.productId,
        productName: input.productName,
      };
      setActiveProductId(input.productId);
      try {
        await ensureSignedInForCart();
      } catch (e) {
        if (e instanceof SignInRequiredError) {
          setActiveProductId(null);
          return;
        }
        setActiveProductId(null);
        throw e;
      }

      const safeCommit = async (
        payload: Parameters<typeof commitAdd.mutateAsync>[0],
      ) => {
        try {
          await commitAdd.mutateAsync(payload);
        } catch (e) {
          setActiveProductId(null);
          const msg = e instanceof Error ? e.message : '';
          if (msg.includes('not available for delivery')) return;
          throw e;
        }
      };

      if (!hasSavedAddress || !location) {
        await savePendingAddToCart({
          productId: input.productId,
          variantId: input.variantId,
          quantity: input.quantity ?? 1,
        });
        setActiveProductId(null);
        router.push('/login-address');
        return;
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
        setActiveProductId(null);
        return;
      }

      // In service area but no store offers this SKU — add anyway (availability checked at checkout).
      if (flow.status === 'NO_VENDORS') {
        await safeCommit({
          productId: flow.productId,
          variantId: flow.variantId,
          quantity: flow.quantity,
          deferAvailability: true,
        });
        return;
      }

      if (flow.status === 'SELECT_VENDOR') {
        const pickVendor = (vendorId: string | null | undefined) =>
          flow.vendors.find((v) => v.vendorId === vendorId) ?? flow.vendors[0];

        const shouldCompare =
          flow.showVendorCompare === true ||
          (flow.showVendorCompare === undefined && flow.vendors.length > 1);

        if (shouldCompare && flow.vendors.length > 1) {
          setCompareFlow({ ...flow, contextVendorId: input.contextVendorId });
          setActiveProductId(null);
          return;
        }

        const v = pickVendor(flow.autoVendorId ?? flow.recommendedVendorId);
        if (!v) {
          setActiveProductId(null);
          return;
        }
        await safeCommit({
          productId: flow.productId,
          variantId: flow.variantId,
          vendorId: v.vendorId,
          vendorProductId: v.vendorProductId,
          quantity: flow.quantity,
        });
        return;
      }

      await safeCommit({
        productId: flow.productId,
        variantId: flow.variantId,
        quantity: flow.quantity,
        deferAvailability: true,
      });
    },
    [commitAdd, hasSavedAddress, location, notifyItemAdded],
  );

  const isAddingProduct = useCallback(
    (productId: string) => activeProductId === productId,
    [activeProductId],
  );

  const startAddToCart = useCallback(
    async (input: StartAddInput) => {
      await runFlow(input);
    },
    [runFlow],
  );

  const value = useMemo(
    () => ({
      startAddToCart,
      isPending: commitAdd.isPending || activeProductId != null,
      isAddingProduct,
    }),
    [activeProductId, commitAdd.isPending, isAddingProduct, startAddToCart],
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
          setActiveProductId(compareFlow.productId);
          commitAdd.mutate({
            productId: compareFlow.productId,
            variantId: compareFlow.variantId,
            vendorId: v.vendorId,
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

  return (
    <Modal visible={Boolean(flow)} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <View
          style={{
            maxHeight: '80%',
            backgroundColor: theme.surface,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            padding: spacing.lg,
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: '800', marginBottom: spacing.md }}>Lower prices elsewhere</Text>
          {referenceVendor ? (
            <Text style={{ color: theme.muted, marginBottom: spacing.sm, lineHeight: 20 }}>
              Your store ({referenceVendor.vendorName}) — ₹{referenceVendor.finalUnitPrice.toFixed(0)}. These
              stores offer a better price:
            </Text>
          ) : flow?.actualPrice ? (
            <Text style={{ color: theme.muted, marginBottom: spacing.sm }}>
              Actual price ₹{flow.actualPrice.toFixed(0)} — pick a store below
            </Text>
          ) : null}
          <ScrollView>
            {vendors.map((v) => (
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
                  tag: 'LOWER PRICE',
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
                      <Text style={{ color: 'white', textAlign: 'center', fontWeight: '700' }}>Select store</Text>
                    </Pressable>
                  ),
                }}
              />
            ))}
          </ScrollView>
          {referenceVendor ? (
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
                Continue with {referenceVendor.vendorName}
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

