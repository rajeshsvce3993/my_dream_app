import { logger } from '../../infrastructure/logging/logger.js';
import { NotificationModel } from '../notifications/notification.model.js';
import { OrderModel } from '../orders/order.model.js';
import { ProductModel } from '../products/product.model.js';
import { CustomerModel } from '../customers/customer.model.js';
import { CustomerAddressModel } from '../customers/customerAddress.model.js';
import { UserModel } from '../users/user.model.js';
import { VendorModel } from '../vendors/vendor.model.js';
import { VendorOrderModel } from '../orders/vendorOrder.model.js';
import { DeliveryOfferModel } from './deliveryOffer.model.js';
import { riderPaySummary } from './deliveryEarnings.service.js';
import { DeliveryPersonModel, type IDeliveryPersonDocument } from './deliveryPerson.model.js';
import { OFFER_TTL_MS, READY_FOR_DISPATCH, pickRandom } from './deliverySelection.js';
import {
  getDeliveryServiceAreas,
  isPointInsideLaunchArea,
  isPointWithinRiderReach,
  type DeliveryServiceArea,
} from './deliveryServiceAreas.service.js';

const UNASSIGNED = { $in: [null] as Array<null> };

function freshPoint(
  person: { currentLocation?: { coordinates?: number[] }; locationUpdatedAt?: Date | null },
  now: number,
  maxAgeMs: number,
): [number, number] | null {
  const loc = person.currentLocation?.coordinates;
  if (!loc || loc.length < 2) return null;
  const updated = person.locationUpdatedAt ? new Date(person.locationUpdatedAt).getTime() : 0;
  if (!updated || now - updated > maxAgeMs) return null;
  const lng = loc[0];
  const lat = loc[1];
  if (lng === undefined || lat === undefined || !Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return [lng, lat];
}

/** Launch circles that contain the drop pin, or the restaurant pin when the drop pin is missing. */
async function launchAreaIdsForOrder(
  order: {
    _id: unknown;
    deliveryAddress?: { location?: { coordinates?: number[] } };
  },
  areas: DeliveryServiceArea[],
): Promise<Set<string>> {
  const points: Array<[number, number]> = [];
  const drop = order.deliveryAddress?.location?.coordinates;
  if (drop && drop.length >= 2 && drop[0] !== undefined && drop[1] !== undefined) {
    points.push([drop[0], drop[1]]);
  } else {
    const slices = await VendorOrderModel.find({ parentOrderId: order._id }).select('vendorId').lean();
    const vendors = await VendorModel.find({ _id: { $in: slices.map((slice) => slice.vendorId) } })
      .select('location')
      .lean();
    for (const vendor of vendors) {
      const coords = vendor.location?.coordinates;
      if (!coords || coords.length < 2 || coords[0] === undefined || coords[1] === undefined) continue;
      points.push([coords[0], coords[1]]);
    }
  }

  const ids = new Set<string>();
  for (const [lng, lat] of points) {
    for (const area of areas) {
      if (isPointInsideLaunchArea(lng, lat, area)) ids.add(area.id);
    }
  }
  return ids;
}

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

  const LOCATION_MAX_AGE_MS = 15 * 60 * 1000;
  const people = await eligiblePeople();
  const areas = await getDeliveryServiceAreas();
  let poolSource = people;
  if (areas.length) {
    const areaIds = await launchAreaIdsForOrder(order, areas);
    const now = Date.now();
    poolSource = people.filter((person) => {
      const point = freshPoint(person, now, LOCATION_MAX_AGE_MS);
      if (!point) return false;
      // No drop or restaurant pin inside a launch circle: still offer online riders with a live location.
      if (!areaIds.size) return true;
      return areas.some(
        (area) => areaIds.has(area.id) && isPointWithinRiderReach(point[0], point[1], area),
      );
    });
  }
  const ridersWithOpenOffer = await DeliveryOfferModel.find({
    deliveryPersonId: { $in: poolSource.map((person) => person._id) },
    status: 'PENDING',
    expiresAt: { $gt: new Date() },
  })
    .select('deliveryPersonId')
    .lean();
  const busy = new Set(ridersWithOpenOffer.map((offer) => offer.deliveryPersonId.toString()));
  poolSource = poolSource.filter((person) => !busy.has(person._id.toString()));

  const blocked = await blockedPersonIds(orderId);
  const hardBlocked = await DeliveryOfferModel.find({
    orderId,
    status: { $in: ['PENDING', 'ACCEPTED', 'REJECTED'] },
  })
    .select('deliveryPersonId')
    .lean();
  const hard = new Set(hardBlocked.map((o) => o.deliveryPersonId.toString()));
  let pool = poolSource.filter((p) => !blocked.has(p._id.toString()));
  if (pool.length === 0) {
    pool = poolSource.filter((p) => !hard.has(p._id.toString()));
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
    body: { en: `Order ${order.orderNumber} was accepted by the restaurant. Accept within ${Math.round(OFFER_TTL_MS / 1000)} seconds.` },
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
    .sort({ updatedAt: -1 })
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

export async function loadOrderPickups(orderId: unknown) {
  const vendorOrders = await VendorOrderModel.find({ parentOrderId: orderId }).select('vendorId').lean();
  const vendors = await VendorModel.find({ _id: { $in: vendorOrders.map((slice) => slice.vendorId) } })
    .select('name phone address location')
    .lean();
  return vendors.map((vendor) => {
    const address = vendor.address;
    const line = [address?.line1, address?.line2, address?.city, address?.state, address?.postalCode]
      .filter(Boolean)
      .join(', ');
    const coordinates = vendor.location?.coordinates;
    return {
      name: vendor.name,
      phone: vendor.phone ?? null,
      address: line,
      lng: coordinates?.[0] ?? null,
      lat: coordinates?.[1] ?? null,
    };
  });
}

export async function loadOrderDrop(order: {
  customerId: unknown;
  deliveryAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    location?: { coordinates?: number[] };
  };
}) {
  const address = order.deliveryAddress;
  const customer = await CustomerModel.findById(order.customerId).select('userId').lean();
  const [user, savedAddresses] = await Promise.all([
    customer ? UserModel.findById(customer.userId).select('firstName lastName phone').lean() : null,
    CustomerAddressModel.find({ customerId: order.customerId })
      .select('fullName phone line1 landmark deliveryInstructions isDefault')
      .lean(),
  ]);
  const saved =
    savedAddresses.find((row) => row.line1 && row.line1 === address?.line1) ??
    savedAddresses.find((row) => row.isDefault) ??
    savedAddresses[0];
  const place = [address?.city, address?.state, address?.postalCode].filter(Boolean).join(', ');
  const lines = [address?.line1, address?.line2, saved?.landmark, place].filter(Boolean);
  const accountName = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  return {
    name: saved?.fullName || accountName || 'Customer',
    phone: saved?.phone || user?.phone || null,
    address: lines.join(', '),
    note: saved?.deliveryInstructions || null,
    coordinates: address?.location?.coordinates ?? null,
  };
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
  const vendorOrders = await VendorOrderModel.find({ parentOrderId: order._id }).select('vendorId items').lean();
  const pickups = await loadOrderPickups(order._id);
  const productIds = [...new Set(vendorOrders.flatMap((slice) => slice.items.map((line) => line.productId.toString())))];
  const products = productIds.length
    ? await ProductModel.find({ _id: { $in: productIds } }).select('name').lean()
    : [];
  const productNames = new Map(products.map((product) => [product._id.toString(), product.name?.en]));
  const pay = await riderPaySummary(order);
  return {
    id: offer._id,
    expiresAt: offer.expiresAt,
    attempt: offer.attempt,
    order: {
      id: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      earning: pay.earning,
      collectAmount: pay.collectAmount,
      paymentMethod: pay.paymentMethod,
      currency: order.currency,
      pickupNames: pickups.map((pickup) => pickup.name),
      pickups,
      items: vendorOrders.flatMap((slice) =>
        slice.items.map((line) => ({
          quantity: line.quantity,
          name: productNames.get(line.productId.toString()) || 'Item',
        })),
      ),
    },
  };
}
