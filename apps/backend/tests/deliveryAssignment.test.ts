import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { OrderModel } from '../src/modules/orders/order.model.js';
import { UserModel } from '../src/modules/users/user.model.js';
import { DeliveryPersonModel } from '../src/modules/delivery/deliveryPerson.model.js';
import { DeliveryOfferModel } from '../src/modules/delivery/deliveryOffer.model.js';
import { acceptOffer } from '../src/modules/delivery/deliveryAssignment.service.js';
import { dispatchOrder } from '../src/modules/delivery/deliveryDispatch.service.js';

let memory: MongoMemoryServer;

async function makeRider(name: string, availability: 'ONLINE' | 'OFFLINE') {
  const user = await UserModel.create({
    email: `${name}-${Date.now()}-${Math.random()}@delivery.test`,
    passwordHash: 'hash',
    firstName: name,
    roleIds: [],
    isActive: true,
  });
  const person = await DeliveryPersonModel.create({
    userId: user._id,
    approvalStatus: 'APPROVED',
    onboardingComplete: true,
    availability,
    activeOrderId: null,
  });
  return { user, person };
}

async function makeOrder() {
  return OrderModel.create({
    orderNumber: `ORD-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    customerId: new mongoose.Types.ObjectId(),
    status: 'PACKED',
    paymentStatus: 'CAPTURED',
    items: [
      {
        vendorId: new mongoose.Types.ObjectId(),
        productId: new mongoose.Types.ObjectId(),
        variantId: new mongoose.Types.ObjectId(),
        quantity: 1,
        unitPrice: 100,
        taxAmount: 0,
        discountAmount: 0,
        lineTotal: 100,
      },
    ],
    subtotal: 100,
    taxTotal: 0,
    shippingTotal: 40,
    grandTotal: 140,
    currency: 'INR',
    deliveryAddress: { line1: '12 Anna Nagar', city: 'Chennai', country: 'IN' },
    timeline: [{ status: 'PACKED', at: new Date() }],
  });
}

beforeAll(async () => {
  memory = await MongoMemoryServer.create();
  await mongoose.connect(memory.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await memory.stop();
});

describe('delivery assignment', () => {
  it('assigns exactly one rider when the same offer is accepted concurrently', async () => {
    const order = await makeOrder();
    const rider = await makeRider('A', 'ONLINE');
    const offer = await DeliveryOfferModel.create({
      orderId: order._id,
      deliveryPersonId: rider.person._id,
      status: 'PENDING',
      attempt: 1,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const results = await Promise.allSettled([
      acceptOffer(rider.user._id.toString(), offer._id.toString()),
      acceptOffer(rider.user._id.toString(), offer._id.toString()),
      acceptOffer(rider.user._id.toString(), offer._id.toString()),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled.length).toBeGreaterThan(0);
    const saved = await OrderModel.findById(order._id).lean();
    expect(saved?.deliveryPersonUserId?.toString()).toBe(rider.user._id.toString());
    const assignedCount = await OrderModel.countDocuments({
      _id: order._id,
      deliveryPersonUserId: rider.user._id,
    });
    expect(assignedCount).toBe(1);
  });

  it('rejects a second rider when the order is already assigned', async () => {
    const order = await makeOrder();
    const a = await makeRider('A2', 'ONLINE');
    const b = await makeRider('B2', 'ONLINE');
    const offerA = await DeliveryOfferModel.create({
      orderId: order._id,
      deliveryPersonId: a.person._id,
      status: 'PENDING',
      attempt: 1,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await acceptOffer(a.user._id.toString(), offerA._id.toString());

    await DeliveryOfferModel.updateOne({ _id: offerA._id }, { $set: { status: 'CANCELLED' } });
    const offerB = await DeliveryOfferModel.create({
      orderId: order._id,
      deliveryPersonId: b.person._id,
      status: 'PENDING',
      attempt: 1,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(acceptOffer(b.user._id.toString(), offerB._id.toString())).rejects.toThrow(
      /already been assigned/i,
    );
    const saved = await OrderModel.findById(order._id).lean();
    expect(saved?.deliveryPersonUserId?.toString()).toBe(a.user._id.toString());
  });

  it('does not offer an order to an offline rider', async () => {
    await DeliveryPersonModel.updateMany({}, { $set: { availability: 'OFFLINE', activeOrderId: new mongoose.Types.ObjectId() } });
    const order = await makeOrder();
    await makeRider('Offline', 'OFFLINE');
    await dispatchOrder(order._id.toString());
    const offers = await DeliveryOfferModel.countDocuments({ orderId: order._id });
    expect(offers).toBe(0);
  });

  it('offers a packed order to an online eligible rider', async () => {
    await DeliveryPersonModel.updateMany({}, { $set: { availability: 'OFFLINE', activeOrderId: new mongoose.Types.ObjectId() } });
    const order = await makeOrder();
    const rider = await makeRider('Online', 'ONLINE');
    await dispatchOrder(order._id.toString());
    const offer = await DeliveryOfferModel.findOne({ orderId: order._id, status: 'PENDING' }).lean();
    expect(offer?.deliveryPersonId.toString()).toBe(rider.person._id.toString());
  });

  it('does not offer a second order to a rider who already has an active delivery', async () => {
    await DeliveryPersonModel.updateMany({}, { $set: { availability: 'OFFLINE', activeOrderId: new mongoose.Types.ObjectId() } });
    const active = await makeOrder();
    const waiting = await makeOrder();
    const rider = await makeRider('Busy', 'ONLINE');
    rider.person.activeOrderId = active._id;
    await rider.person.save();
    await dispatchOrder(waiting._id.toString());
    const offers = await DeliveryOfferModel.countDocuments({ orderId: waiting._id });
    expect(offers).toBe(0);
  });
});
