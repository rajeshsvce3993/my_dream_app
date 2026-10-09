import { ConflictError, BusinessRuleError } from '../../common/errors/AppError.js';
import { logger } from '../../infrastructure/logging/logger.js';
import { UserModel } from '../users/user.model.js';
import { CustomerModel } from '../customers/customer.model.js';
import { NotificationModel } from '../notifications/notification.model.js';
import { OrderModel } from '../orders/order.model.js';
import { VendorOrderModel } from '../orders/vendorOrder.model.js';
import type { OrderStatus } from '../orders/orderStateMachine.js';
import { quoteDeliveryEarning } from './deliveryEarnings.service.js';
import { READY_FOR_DISPATCH } from './deliverySelection.js';
import { DeliveryOfferModel } from './deliveryOffer.model.js';
import { DeliveryPersonModel } from './deliveryPerson.model.js';
import { getDeliveryPersonByUserId } from './deliveryAvailability.service.js';

const UNASSIGNED = { $in: [null] as Array<null> };

const VENDOR_TERMINAL = new Set(['CANCELLED', 'REFUNDED', 'FAILED', 'REFUND_REQUESTED']);

async function mirrorVendorOrders(
  parentOrderId: unknown,
  status: OrderStatus,
  note: string,
): Promise<void> {
  const rows = await VendorOrderModel.find({ parentOrderId });
  const at = new Date();
  for (const vo of rows) {
    if (vo.status === status || VENDOR_TERMINAL.has(vo.status)) continue;
    vo.status = status;
    vo.timeline.push({ status, at, note });
    await vo.save();
  }
}

async function notifyCustomer(
  orderId: string,
  orderNumber: string,
  event: string,
  title: string,
  body: string,
): Promise<void> {
  const order = await OrderModel.findById(orderId).lean();
  if (!order) return;
  const customer = await CustomerModel.findById(order.customerId).lean();
  if (!customer) return;
  await NotificationModel.create({
    userId: customer.userId,
    channel: 'IN_APP',
    event,
    title: { en: title },
    body: { en: body },
    data: { orderId, orderNumber },
  }).catch((err) => logger.error({ err }, 'Failed to persist delivery notification'));
}

/**
 * Idempotent, compare-and-set acceptance.
 * The authenticated user id is the only rider identity used.
 */
export async function acceptOffer(userId: string, offerId: string) {
  const person = await getDeliveryPersonByUserId(userId);
  const user = await UserModel.findById(person.userId).select('isActive').lean();
  if (!user || !user.isActive) throw new BusinessRuleError('Account is inactive');
  if (person.approvalStatus !== 'APPROVED' || !person.onboardingComplete) {
    throw new BusinessRuleError('Account is not eligible to accept deliveries');
  }
  if (person.availability !== 'ONLINE') throw new BusinessRuleError('Go online before accepting deliveries');
  if (person.activeOrderId) {
    throw new BusinessRuleError('You already have an active delivery');
  }

  const now = new Date();
  const offer = await DeliveryOfferModel.findOneAndUpdate(
    {
      _id: offerId,
      deliveryPersonId: person._id,
      status: 'PENDING',
      expiresAt: { $gt: now },
    },
    { $set: { status: 'ACCEPTED', acceptedAt: now } },
    { new: true },
  );

  if (!offer) {
    const existing = await DeliveryOfferModel.findOne({ _id: offerId, deliveryPersonId: person._id });
    if (existing?.status === 'ACCEPTED') {
      const order = await OrderModel.findOne({
        _id: existing.orderId,
        deliveryPersonUserId: userId,
      });
      if (order) return { order, alreadyAssigned: true };
    }
    throw new ConflictError('This offer is no longer available.');
  }

  const preview = await OrderModel.findById(offer.orderId).lean();
  const earning = await quoteDeliveryEarning(preview ?? {});

  let claimed;
  try {
    claimed = await OrderModel.findOneAndUpdate(
    {
      _id: offer.orderId,
      status: { $in: [...READY_FOR_DISPATCH] },
      deliveryPersonUserId: UNASSIGNED,
    },
    {
      $set: {
        deliveryPersonUserId: userId,
        assignedAt: now,
        deliveryEarning: earning,
      },
      $push: {
        timeline: {
          status: preview?.status ?? 'PROCESSING',
          at: now,
          by: person.userId,
          note: 'Delivery partner assigned',
        },
      },
    },
      { new: true },
    );
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      await DeliveryOfferModel.updateOne({ _id: offer._id, status: 'ACCEPTED' }, { $set: { status: 'CANCELLED' } });
      throw new ConflictError('You already have an active delivery.');
    }
    throw err;
  }

  if (!claimed) {
    const current = await OrderModel.findById(offer.orderId).lean();
    if (current?.deliveryPersonUserId?.toString() === userId) {
      await DeliveryPersonModel.updateOne(
        { _id: person._id, activeOrderId: UNASSIGNED },
        { $set: { activeOrderId: current._id, lastSeenAt: now } },
      );
      return { order: current, alreadyAssigned: true };
    }
    await DeliveryOfferModel.updateOne(
      { _id: offer._id, status: 'ACCEPTED' },
      { $set: { status: 'CANCELLED' } },
    );
    throw new ConflictError('This order has already been assigned.');
  }

  const slot = await DeliveryPersonModel.findOneAndUpdate(
    { _id: person._id, availability: 'ONLINE', activeOrderId: UNASSIGNED },
    { $set: { activeOrderId: claimed._id, lastSeenAt: now } },
    { new: true },
  );

  if (!slot) {
    const again = await DeliveryPersonModel.findById(person._id).lean();
    if (again?.activeOrderId?.toString() !== claimed._id.toString()) {
      await OrderModel.updateOne(
        { _id: claimed._id, deliveryPersonUserId: userId },
        {
          $set: { deliveryPersonUserId: null },
          $unset: { assignedAt: 1 },
        },
      );
      await DeliveryOfferModel.updateOne({ _id: offer._id }, { $set: { status: 'CANCELLED' } });
      throw new ConflictError('You already have an active delivery.');
    }
  }

  await DeliveryOfferModel.updateMany(
    { orderId: claimed._id, _id: { $ne: offer._id }, status: 'PENDING' },
    { $set: { status: 'CANCELLED' } },
  );

  await notifyCustomer(
    claimed._id.toString(),
    claimed.orderNumber,
    'DELIVERY_ASSIGNED',
    'Delivery partner assigned',
    `A delivery partner is assigned to order ${claimed.orderNumber}.`,
  );
  return { order: claimed, alreadyAssigned: false };
}

export async function rejectOffer(userId: string, offerId: string) {
  const person = await getDeliveryPersonByUserId(userId);
  const now = new Date();
  const offer = await DeliveryOfferModel.findOneAndUpdate(
    { _id: offerId, deliveryPersonId: person._id, status: 'PENDING' },
    { $set: { status: 'REJECTED', rejectedAt: now } },
    { new: true },
  );
  if (!offer) throw new ConflictError('This offer is no longer available.');
  return offer;
}

export async function markPickedUp(userId: string) {
  const person = await getDeliveryPersonByUserId(userId);
  if (!person.activeOrderId) throw new BusinessRuleError('No active delivery');
  const now = new Date();
  const updated = await OrderModel.findOneAndUpdate(
    {
      _id: person.activeOrderId,
      deliveryPersonUserId: userId,
      status: 'READY_FOR_PICKUP',
    },
    {
      $set: { status: 'OUT_FOR_DELIVERY', pickedUpAt: now },
      $push: {
        timeline: { status: 'OUT_FOR_DELIVERY', at: now, by: person.userId, note: 'Picked up' },
      },
    },
    { new: true },
  );
  const current =
    updated ??
    (await OrderModel.findOne({ _id: person.activeOrderId, deliveryPersonUserId: userId }));
  if (!current || (current.status !== 'OUT_FOR_DELIVERY' && current.status !== 'DELIVERED')) {
    throw new BusinessRuleError('Pickup is not available for this order');
  }
  if (current.status === 'DELIVERED') return current;
  await mirrorVendorOrders(current._id, 'OUT_FOR_DELIVERY', 'Picked up from restaurant');
  if (updated) {
    await notifyCustomer(
      current._id.toString(),
      current.orderNumber,
      'OUT_FOR_DELIVERY',
      'Order picked up',
      `Order ${current.orderNumber} is on the way.`,
    );
  }
  return current;
}

export async function markDelivered(userId: string) {
  const person = await getDeliveryPersonByUserId(userId);
  if (!person.activeOrderId) throw new BusinessRuleError('No active delivery');
  const now = new Date();
  const updated = await OrderModel.findOneAndUpdate(
    {
      _id: person.activeOrderId,
      deliveryPersonUserId: userId,
      status: 'OUT_FOR_DELIVERY',
    },
    {
      $set: { status: 'DELIVERED', deliveredAt: now },
      $push: {
        timeline: { status: 'DELIVERED', at: now, by: person.userId, note: 'Delivered' },
      },
    },
    { new: true },
  );
  const order =
    updated ??
    (await OrderModel.findOne({ _id: person.activeOrderId, deliveryPersonUserId: userId, status: 'DELIVERED' }));
  if (!order) throw new BusinessRuleError('Delivery confirmation is not available for this order');

  await mirrorVendorOrders(order._id, 'DELIVERED', 'Delivered to customer');
  await DeliveryPersonModel.updateOne(
    { _id: person._id, activeOrderId: order._id },
    { $set: { activeOrderId: null, lastSeenAt: now } },
  );
  if (updated) {
    await notifyCustomer(
      order._id.toString(),
      order.orderNumber,
      'DELIVERED',
      'Order delivered',
      `Order ${order.orderNumber} has been delivered.`,
    );
  }
  return order;
}

export async function releaseAssignmentForTerminalOrder(orderId: string): Promise<void> {
  await DeliveryOfferModel.updateMany(
    { orderId, status: 'PENDING' },
    { $set: { status: 'CANCELLED' } },
  );
  await DeliveryPersonModel.updateMany({ activeOrderId: orderId }, { $set: { activeOrderId: null } });
}
