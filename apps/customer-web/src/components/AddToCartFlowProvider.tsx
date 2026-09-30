import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { addCartItem, ensureSignedInForCart, SignInRequiredError } from '../lib/addToCart';
import {
  fetchAddToCartFlow,
  type AddToCartFlowResult,
  type AddToCartFlowVendor,
} from '../lib/addToCartFlowApi';
import {
  confirmSingleRestaurantCart,
  isCartOtherRestaurantError,
  promptReplaceAfterConflict,
} from '../lib/singleRestaurantCart';
import { useLocationContext } from '../context/LocationContext';
import { formatMoney } from '../lib/format';
import { useBrand } from '../hooks/useBrand';

type StartAddInput = {
  productId: string;
  variantId?: string;
  quantity?: number;
  productName?: string;
  contextVendorId?: string;
  contextVendorName?: string;
  skipVendorCompare?: boolean;
};

type CompareFlowState = AddToCartFlowResult & { contextVendorId?: string };

type FlowContextValue = {
  startAddToCart: (input: StartAddInput) => Promise<boolean>;
  isPending: boolean;
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
  const navigate = useNavigate();
  const { location } = useLocationContext();
  const [compareFlow, setCompareFlow] = useState<CompareFlowState | null>(null);
  const [activeAddKey, setActiveAddKey] = useState<string | null>(null);
  const addMetaRef = useRef<{ productId: string; productName?: string } | null>(null);
  const addLockRef = useRef<Promise<unknown> | null>(null);

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
          location: { lng: location.lng, lat: location.lat },
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
          location: { lng: location.lng, lat: location.lat },
          vendorProductId: input.vendorProductId,
          deferAvailability: input.deferAvailability,
          replaceCart: true,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cart'] });
      setCompareFlow(null);
      setActiveAddKey(null);
    },
    onError: () => {
      setActiveAddKey(null);
    },
  });

  const runFlow = useCallback(
    async (input: StartAddInput): Promise<boolean> => {
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
          await ensureSignedInForCart(window.location.pathname + window.location.search);
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
            return false;
          }
        };

        if (!location.lng || !location.lat) {
          setActiveAddKey(null);
          navigate('/delivery-address');
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

        if (flow.status === 'OUTSIDE_SERVICE_AREA') {
          setActiveAddKey(null);
          window.alert(flow.messages?.body ?? 'Your address is outside our delivery area.');
          return false;
        }

        if (flow.status === 'NO_VENDORS') {
          return safeCommit({
            productId: flow.productId,
            variantId: flow.variantId,
            quantity: flow.quantity,
            deferAvailability: true,
          });
        }

        if (flow.status === 'SELECT_VENDOR') {
          const pickExactVendor = (vendorId: string | null | undefined) => {
            if (!vendorId) return undefined;
            return (
              flow.vendors.find((v) => v.vendorId === vendorId) ??
              (flow.referenceVendor?.vendorId === vendorId ? flow.referenceVendor : undefined)
            );
          };

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
    [commitAdd, location.lat, location.lng, navigate],
  );

  const isAddingProduct = useCallback(
    (productId: string, vendorId?: string) =>
      activeAddKey === addInFlightKey(productId, vendorId),
    [activeAddKey],
  );

  const value = useMemo(
    () => ({
      startAddToCart: runFlow,
      isPending: commitAdd.isPending || activeAddKey != null,
      isAddingProduct,
    }),
    [activeAddKey, commitAdd.isPending, isAddingProduct, runFlow],
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
  const { currency } = useBrand();
  if (!flow) return null;

  const referenceVendor = flow.referenceVendor;
  const vendors = flow.vendors;
  const isChoose = flow.compareMode === 'choose' || (!referenceVendor && vendors.length > 0);
  const title = isChoose ? 'Choose restaurant' : 'Better price nearby?';
  const subtitle = isChoose
    ? 'This dish is available at more than one restaurant near you.'
    : referenceVendor
      ? `${referenceVendor.vendorName} — ${formatMoney(currency, referenceVendor.finalUnitPrice)}. Other restaurants are cheaper:`
      : 'Pick a restaurant below';

  return (
    <div className="qc-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="compare-title">
      <div className="qc-modal">
        <header className="qc-modal__head">
          <div>
            <h2 id="compare-title">{title}</h2>
            <p className="qc-caption">{subtitle}</p>
          </div>
          <button type="button" className="qc-icon-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </header>
        <ul className="qc-compare-list">
          {vendors.map((v) => (
            <li key={v.vendorId}>
              <button
                type="button"
                className="qc-compare-card"
                disabled={loading || !v.isOpen}
                onClick={() => onSelect(v)}
              >
                <div>
                  <strong>{v.vendorName}</strong>
                  <span className="qc-meta">
                    ★ {v.rating.toFixed(1)}
                    {v.distanceKm != null ? ` · ${v.distanceKm.toFixed(1)} km` : ''}
                    {v.deliveryEstimateMinutes ? ` · ${v.deliveryEstimateMinutes} min` : ''}
                  </span>
                  {!v.isOpen ? <span className="qc-meta">Closed</span> : null}
                </div>
                <div className="qc-compare-card__price">
                  <span className="qc-price">{formatMoney(currency, v.finalUnitPrice)}</span>
                  {v.discountPercent ? (
                    <span className="qc-badge qc-badge--discount">-{v.discountPercent}%</span>
                  ) : null}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
