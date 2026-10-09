import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { BusinessRuleError, ConflictError } from '../../common/errors/AppError.js';
import { withMongoTransaction } from '../../infrastructure/database/withMongoTransaction.js';
import { eventBus } from '../../infrastructure/events/EventBus.js';
import { getConfigValue } from '../configuration/configuration.service.js';
import { recalculateCart, getCartForUser } from '../cart/cart.service.js';
import { confirmSaleFromReservation, releaseInventory, reserveInventory } from '../inventory/inventory.service.js';
import { nextOrderNumber } from '../orders/orderNumber.util.js';
import { OrderModel } from '../orders/order.model.js';
import { assertValidTransition } from '../orders/orderStateMachine.js';
import { VendorOrderModel } from '../orders/vendorOrder.model.js';
import { PaymentModel } from '../payments/payment.model.js';
import { getPaymentProvider } from '../payments/paymentProvider.factory.js';
import { VendorModel } from '../vendors/vendor.model.js';
import { vendorIdsAcceptingOrders } from '../vendors/vendorStaffAccess.service.js';
import { vendorEarningsFromItemTotal } from '../../common/money.util.js';
import { meetsMinimumOrderValue, parseMinOrderValue } from './orderMinimum.util.js';
import { foodProductIdSet } from '../pricing/foodCharges.service.js';

function sessionOpts(session: mongoose.ClientSession | null) {
  return session ? { session } : {};
}

export async function checkout(input: {
  userId: string;
  idempotencyKey: string;
  deliveryAddress: {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode?: string;
    country: string;
    lng?: number;
    lat?: number;
  };
  paymentMethod: 'COD' | 'RAZORPAY' | 'STRIPE';
}) {
  const existing = await OrderModel.findOne({ idempotencyKey: input.idempotencyKey }).lean();
  if (existing) return { order: existing, duplicate: true };

  const cart = await getCartForUser(input.userId);
  if (!cart.items.length) throw new BusinessRuleError('Cart is empty');

  const calculated = await recalculateCart(cart._id.toString());
  const foodProductIds = await foodProductIdSet(calculated.lines.map((line) => line.productId));
  const foodOrder =
    calculated.lines.length > 0 && calculated.lines.every((line) => foodProductIds.has(line.productId));
  if (!foodOrder) {
    const minOrderRaw = await getConfigValue<number>('order.minValue', 0);
    const minOrder = parseMinOrderValue(minOrderRaw, 0);
    if (!meetsMinimumOrderValue(calculated.grandTotal, minOrder)) {
      throw new BusinessRuleError(
        `Minimum order value is ₹${minOrder}. Your order total is ₹${Math.round(calculated.grandTotal * 100) / 100}.`,
      );
    }
  }

  try {
    return await withMongoTransaction(async (session) => {
      const reservationRef = randomUUID();
      for (const line of calculated.lines) {
        try {
          await reserveInventory(session, line.vendorId, line.variantId, line.quantity, {
            type: 'CHECKOUT',
            id: reservationRef,
          });
        } catch (err) {
          const pending = cart.items.find(
            (i) =>
              i.variantId.toString() === line.variantId &&
              i.vendorId.toString() === line.vendorId &&
              i.availabilityPending,
          );
          if (pending) continue;
          throw err;
        }
      }

      const orderNumber = await nextOrderNumber(input.deliveryAddress.lng, input.deliveryAddress.lat);
      const currency = await getConfigValue<string>('currency.code', 'INR');

      const order = await OrderModel.create(
        [
          {
            orderNumber,
            customerId: cart.customerId,
            status: input.paymentMethod === 'COD' ? 'CONFIRMED' : 'PENDING_PAYMENT',
            paymentStatus: input.paymentMethod === 'COD' ? 'CAPTURED' : 'PENDING',
            items: calculated.lines.map((l) => ({
              vendorId: l.vendorId,
              productId: l.productId,
              variantId: l.variantId,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              taxAmount: l.taxAmount,
              discountAmount: 0,
              lineTotal: l.lineTotal,
            })),
            subtotal: calculated.subtotal,
            discountTotal: calculated.discountTotal,
            taxTotal: calculated.taxTotal,
            shippingTotal: calculated.shippingTotal,
            platformFee: calculated.platformFee,
            grandTotal: calculated.grandTotal,
            currency,
            deliveryAddress: {
              ...input.deliveryAddress,
              location:
                input.deliveryAddress.lng !== undefined && input.deliveryAddress.lat !== undefined
                  ? { type: 'Point', coordinates: [input.deliveryAddress.lng, input.deliveryAddress.lat] }
                  : undefined,
            },
            couponCode: cart.couponCode,
            idempotencyKey: input.idempotencyKey,
            timeline: [{ status: input.paymentMethod === 'COD' ? 'CONFIRMED' : 'PENDING_PAYMENT', at: new Date() }],
          },
        ],
        sessionOpts(session),
      );

      const parentOrder = order[0];

      const vendorGroups = new Map<string, typeof calculated.lines>();
      for (const line of calculated.lines) {
        const key = line.vendorId;
        if (!vendorGroups.has(key)) vendorGroups.set(key, []);
        vendorGroups.get(key)!.push(line);
      }

      const vendorOrders = [];
      let shopIndex = 0;
      for (const [vendorId, lines] of vendorGroups) {
        shopIndex += 1;
        const vendor = session
          ? await VendorModel.findById(vendorId).session(session)
          : await VendorModel.findById(vendorId);
        if (!vendor || vendor.status !== 'ACTIVE') throw new BusinessRuleError('Restaurant is not available');
        const accepting = await vendorIdsAcceptingOrders([vendorId]);
        if (!accepting.has(vendorId)) {
          throw new BusinessRuleError('This restaurant is not accepting orders right now');
        }
        const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
        const itemTotal = lines.reduce((s, l) => s + Math.max(0, l.lineTotal - (l.taxAmount ?? 0)), 0);
        const payout = vendorEarningsFromItemTotal(itemTotal, vendor.commissionRate);
        const shippingFee =
          calculated.vendorShipping.find((v) => v.vendorId === vendorId)?.fee ?? 0;
        const vendorOrder = await VendorOrderModel.create(
          [
            {
              parentOrderId: parentOrder._id,
              vendorId,
              orderNumber: vendorGroups.size === 1 ? orderNumber : `${orderNumber}-${shopIndex}`,
              status: input.paymentMethod === 'COD' ? 'CONFIRMED' : 'PENDING_PAYMENT',
              items: lines.map((l) => ({
                productId: l.productId,
                variantId: l.variantId,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
                taxAmount: l.taxAmount ?? 0,
                lineTotal: l.lineTotal,
              })),
              subtotal,
              shippingFee,
              commissionRate: vendor.commissionRate,
              commissionAmount: payout.serviceCharge,
              vendorPayoutAmount: payout.earnings,
              timeline: [{ status: input.paymentMethod === 'COD' ? 'CONFIRMED' : 'PENDING_PAYMENT', at: new Date() }],
            },
          ],
          sessionOpts(session),
        );
        vendorOrders.push(vendorOrder[0]);
      }

      const provider = getPaymentProvider(input.paymentMethod);
      const paymentIntent = await provider.createPaymentIntent({
        orderId: parentOrder._id.toString(),
        amount: parentOrder.grandTotal,
        currency,
        customerId: cart.customerId.toString(),
      });

      await PaymentModel.create(
        [
          {
            orderId: parentOrder._id,
            provider: input.paymentMethod,
            status: paymentIntent.status,
            amount: parentOrder.grandTotal,
            currency,
            providerReference: paymentIntent.providerReference,
          },
        ],
        sessionOpts(session),
      );

      if (input.paymentMethod === 'COD') {
        for (const line of calculated.lines) {
          try {
            await confirmSaleFromReservation(session, line.vendorId, line.variantId, line.quantity, {
              type: 'ORDER',
              id: parentOrder._id.toString(),
            });
          } catch {
            /* skip lines that had no inventory reservation (availability pending) */
          }
        }
      }

      cart.items = [];
      await cart.save(sessionOpts(session));

      await eventBus.emit({
        name: 'OrderCreated',
        payload: { orderId: parentOrder._id.toString(), orderNumber },
        occurredAt: new Date(),
      });

      return {
        order: parentOrder,
        vendorOrders,
        payment: paymentIntent,
        duplicate: false,
      };
    });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      throw new ConflictError('Duplicate checkout request');
    }
    throw err;
  }
}

export async function updateOrderStatus(
  orderId: string,
  toStatus: Parameters<typeof assertValidTransition>[1],
  userId?: string,
  note?: string,
) {
  const { updateParentOrderStatus } = await import('../orders/order.admin.service.js');
  return updateParentOrderStatus(orderId, toStatus, userId, note);
}

export async function cancelCheckoutReservations(referenceId: string, lines: { vendorId: string; variantId: string; quantity: number }[]) {
  await withMongoTransaction(async (session) => {
    for (const line of lines) {
      await releaseInventory(session, line.vendorId, line.variantId, line.quantity, {
        type: 'CHECKOUT_CANCEL',
        id: referenceId,
      });
    }
  });
}
