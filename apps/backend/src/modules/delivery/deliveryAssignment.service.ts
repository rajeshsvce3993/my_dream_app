import { ConflictError, BusinessRuleError } from '../../common/errors/AppError.js';
import { logger } from '../../infrastructure/logging/logger.js';
import { UserModel } from '../users/user.model.js';
import { CustomerModel } from '../customers/customer.model.js';
import { NotificationModel } from '../notifications/notification.model.js';
import { OrderModel } from '../orders/order.model.js';
import { getConfigValue } from '../configuration/configuration.service.js';
import { DeliveryOfferModel } from './deliveryOffer.model.js';
import { DeliveryPersonModel } from './deliveryPerson.model.js';
import { getDeliveryPersonByUserId } from './deliveryAvailability.service.js';

const UNASSIGNED = { $in: [null] as Array<null> };

async function earningAmount(shippingTotal: number): Promise<number> {
  try {
    const configured = await getConfigValue<number>('delivery.earningPerOrder', shippingTotal);
    return Number(configured) || shippingTotal;
  } catch {
    return shippingTotal;
  }
}

async function notifyCustomerAssigned(orderId: string, orderNumber: string): Promise<void> {
  const order = await OrderModel.findById(orderId).lean();
  if (!order) return;
  const customer = await CustomerModel.findById(order.customerId).lean();
  if (!customer) return;
  await NotificationModel.create({
    userId: customer.userId,
    channel: 'IN_APP',
    event: 'DELIVERY_ASSIGNED',
    title: { en: 'Delivery partner assigned' },
    body: { en: `A delivery partner is assigned to order ${orderNumber}.` },
    data: { orderId, orderNumber },
  }).catch((err) => logger.error({ err }, 'Failed to persist delivery assignment notification'));
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
  const earning = await earningAmount(preview?.shippingTotal ?? 0);

  let claimed;
  try {
    claimed = await OrderModel.findOneAndUpdate(
    {
      _id: offer.orderId,
      status: { $in: ['PACKED', 'READY_FOR_PICKUP'] },
      deliveryPersonUserId: UNASSIGNED,
    },
    {
      $set: {
        deliveryPersonUserId: userId,
        assignedAt: now,
        status: 'READY_FOR_PICKUP',
        deliveryEarning: earning,
      },
      $push: {
        timeline: {
          status: 'READY_FOR_PICKUP',
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
        { _id: claimed._id, deliveryPersonUserId: userId, status: 'READY_FOR_PICKUP' },
        {
          $set: { deliveryPersonUserId: null, status: 'PACKED' },
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

  await notifyCustomerAssigned(claimed._id.toString(), claimed.orderNumber);
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
  if (updated) return updated;
  const current = await OrderModel.findOne({ _id: person.activeOrderId, deliveryPersonUserId: userId });
  if (current?.status === 'OUT_FOR_DELIVERY' || current?.status === 'DELIVERED') return current;
  throw new BusinessRuleError('Pickup is not available for this order');
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

  await DeliveryPersonModel.updateOne(
    { _id: person._id, activeOrderId: order._id },
    { $set: { activeOrderId: null, lastSeenAt: now } },
  );
  return order;
}

export async function releaseAssignmentForTerminalOrder(orderId: string): Promise<void> {
  await DeliveryOfferModel.updateMany(
    { orderId, status: 'PENDING' },
    { $set: { status: 'CANCELLED' } },
  );
  await DeliveryPersonModel.updateMany({ activeOrderId: orderId }, { $set: { activeOrderId: null } });
}
