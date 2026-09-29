import { logger } from '../../infrastructure/logging/logger.js';
import { NotificationModel } from '../notifications/notification.model.js';
import { OrderModel } from '../orders/order.model.js';
import { UserModel } from '../users/user.model.js';
import { VendorModel } from '../vendors/vendor.model.js';
import { VendorOrderModel } from '../orders/vendorOrder.model.js';
import { DeliveryOfferModel } from './deliveryOffer.model.js';
import { DeliveryPersonModel, type IDeliveryPersonDocument } from './deliveryPerson.model.js';
import { OFFER_TTL_MS, READY_FOR_DISPATCH, pickRandom } from './deliverySelection.js';

const UNASSIGNED = { $in: [null] as Array<null> };

export async function expireStaleOffers(now = new Date()): Promise<number> {
  const result = await DeliveryOfferModel.updateMany(
    { status: 'PENDING', expiresAt: { $lte: now } },
    { $set: { status: 'EXPIRED' } },
  );
  return result.modifiedCount;
}

async function eligiblePeople(): Promise<IDeliveryPersonDocument[]> {
  const people = await DeliveryPersonModel.find({
    availability: 'ONLINE',
    approvalStatus: 'APPROVED',
    onboardingComplete: true,
    activeOrderId: UNASSIGNED,
  }).limit(200);

  if (!people.length) return [];
  const users = await UserModel.find({
    _id: { $in: people.map((p) => p.userId) },
    isActive: true,
  })
    .select('_id')
    .lean();
  const active = new Set(users.map((u) => u._id.toString()));
  return people.filter((p) => active.has(p.userId.toString()));
}

async function blockedPersonIds(orderId: string): Promise<Set<string>> {
  const offers = await DeliveryOfferModel.find({
    orderId,
    status: { $in: ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED'] },
  })
    .select('deliveryPersonId status')
    .lean();
  return new Set(offers.map((o) => o.deliveryPersonId.toString()));
}

export async function dispatchOrder(orderId: string): Promise<void> {
  await expireStaleOffers();
  const order = await OrderModel.findOne({
    _id: orderId,
    status: { $in: [...READY_FOR_DISPATCH] },
    deliveryPersonUserId: UNASSIGNED,
  }).lean();
  if (!order) return;

  const pending = await DeliveryOfferModel.findOne({ orderId, status: 'PENDING' }).lean();
  if (pending) return;

  const people = await eligiblePeople();
  const blocked = await blockedPersonIds(orderId);
  const hardBlocked = await DeliveryOfferModel.find({
    orderId,
    status: { $in: ['PENDING', 'ACCEPTED', 'REJECTED'] },
  })
    .select('deliveryPersonId')
    .lean();
  const hard = new Set(hardBlocked.map((o) => o.deliveryPersonId.toString()));
  let pool = people.filter((p) => !blocked.has(p._id.toString()));
  if (pool.length === 0) {
    pool = people.filter((p) => !hard.has(p._id.toString()));
  }
  const chosen = pickRandom(pool);
  if (!chosen) return;

  const attempt =
    (await DeliveryOfferModel.countDocuments({ orderId, deliveryPersonId: chosen._id })) + 1;
  const expiresAt = new Date(Date.now() + OFFER_TTL_MS);
  try {
    await DeliveryOfferModel.create({
      orderId,
      deliveryPersonId: chosen._id,
      status: 'PENDING',
      attempt,
      expiresAt,
    });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return;
    throw err;
  }

  await NotificationModel.create({
    userId: chosen.userId,
    channel: 'IN_APP',
    event: 'DELIVERY_OFFER',
    title: { en: 'New delivery' },
    body: { en: `Order ${order.orderNumber} is ready. Accept within ${Math.round(OFFER_TTL_MS / 1000)} seconds.` },
    data: { orderId: order._id.toString(), orderNumber: order.orderNumber },
  }).catch((err) => logger.error({ err }, 'Failed to persist delivery offer notification'));
}

export async function dispatchReadyOrders(): Promise<void> {
  await expireStaleOffers();
  const orders = await OrderModel.find({
    status: { $in: [...READY_FOR_DISPATCH] },
    deliveryPersonUserId: UNASSIGNED,
  })
    .select('_id')
    .sort({ updatedAt: 1 })
    .limit(25)
    .lean();

  for (const order of orders) {
    try {
      await dispatchOrder(order._id.toString());
    } catch (err) {
      logger.error({ err, orderId: order._id.toString() }, 'Delivery dispatch failed');
    }
  }
}

let timer: NodeJS.Timeout | null = null;

export function startDeliveryDispatchLoop(intervalMs = 5000): void {
  if (timer) return;
  timer = setInterval(() => {
    void dispatchReadyOrders();
  }, intervalMs);
  timer.unref?.();
}

export async function loadOfferCard(deliveryPersonId: string) {
  const offer = await DeliveryOfferModel.findOne({
    deliveryPersonId,
    status: 'PENDING',
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .lean();
  if (!offer) return null;
  const order = await OrderModel.findById(offer.orderId).lean();
  if (!order) return null;
  const vendorOrders = await VendorOrderModel.find({ parentOrderId: order._id }).select('vendorId').lean();
  const vendors = await VendorModel.find({ _id: { $in: vendorOrders.map((v) => v.vendorId) } })
    .select('name')
    .lean();
  return {
    id: offer._id,
    expiresAt: offer.expiresAt,
    attempt: offer.attempt,
    order: {
      id: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      earning: order.deliveryEarning ?? order.shippingTotal,
      currency: order.currency,
      deliveryAddress: order.deliveryAddress,
      pickupNames: vendors.map((v) => v.name),
    },
  };
}
