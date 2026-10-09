import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { VendorModel } from '../src/modules/vendors/vendor.model.js';
import { VendorStaffModel } from '../src/modules/vendors/vendorStaff.model.js';
import { VendorProductModel } from '../src/modules/products/vendorProduct.model.js';
import { VendorOrderModel } from '../src/modules/orders/vendorOrder.model.js';
import { updateVendorProduct } from '../src/modules/vendors/vendorProductPortal.service.js';
import { updateVendorOrderStatusForVendor } from '../src/modules/vendors/vendorOrderPortal.service.js';

let memory: MongoMemoryServer;

beforeAll(async () => {
  memory = await MongoMemoryServer.create();
  await mongoose.connect(memory.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await memory.stop();
});

describe('vendor portal', () => {
  it('rejects product updates for another vendor', async () => {
    const [v1, v2] = await VendorModel.create([
      {
        code: 'V1',
        name: 'One',
        location: { type: 'Point', coordinates: [80.2, 13.08] },
        serviceAreaRadiusKm: 5,
        deliveryRadiusKm: 5,
        serviceAreaWideDelivery: true,
      },
      {
        code: 'V2',
        name: 'Two',
        location: { type: 'Point', coordinates: [80.2, 13.08] },
        serviceAreaRadiusKm: 5,
        deliveryRadiusKm: 5,
        serviceAreaWideDelivery: true,
      },
    ]);
    const productId = new mongoose.Types.ObjectId();
    const variantId = new mongoose.Types.ObjectId();
    const row = await VendorProductModel.create({
      vendorId: v1._id,
      productId,
      variantId,
      vendorPrice: 100,
      mrp: 120,
      sellingPrice: 100,
      isActive: true,
    });

    await expect(updateVendorProduct(v2._id.toString(), row._id.toString(), { sellingPrice: 50 })).rejects.toThrow(
      /not found/i,
    );
  });

  it('preserves historical order line price when vendor product price changes', async () => {
    const vendor = await VendorModel.create({
      code: 'VP',
      name: 'Price Vendor',
      location: { type: 'Point', coordinates: [80.2, 13.08] },
      serviceAreaRadiusKm: 5,
      deliveryRadiusKm: 5,
      serviceAreaWideDelivery: true,
    });
    const productId = new mongoose.Types.ObjectId();
    const variantId = new mongoose.Types.ObjectId();
    const vp = await VendorProductModel.create({
      vendorId: vendor._id,
      productId,
      variantId,
      vendorPrice: 100,
      mrp: 120,
      sellingPrice: 100,
      isActive: true,
    });

    const vo = await VendorOrderModel.create({
      parentOrderId: new mongoose.Types.ObjectId(),
      vendorId: vendor._id,
      orderNumber: 'VORD-SNAP-1',
      status: 'CONFIRMED',
      items: [{ productId, variantId, quantity: 2, unitPrice: 100, lineTotal: 200 }],
      subtotal: 200,
      shippingFee: 0,
      commissionRate: 10,
      commissionAmount: 20,
      vendorPayoutAmount: 180,
      timeline: [{ status: 'CONFIRMED', at: new Date() }],
    });

    await updateVendorProduct(vendor._id.toString(), vp._id.toString(), { sellingPrice: 120 });
    const reloaded = await VendorOrderModel.findById(vo._id).lean();
    expect(reloaded?.items[0]?.unitPrice).toBe(100);
    expect(reloaded?.items[0]?.lineTotal).toBe(200);
  });

  it('uses conditional update for concurrent order status changes', async () => {
    const vendor = await VendorModel.create({
      code: 'VO',
      name: 'Order Vendor',
      location: { type: 'Point', coordinates: [80.2, 13.08] },
      serviceAreaRadiusKm: 5,
      deliveryRadiusKm: 5,
      serviceAreaWideDelivery: true,
    });
    await VendorStaffModel.create({
      userId: new mongoose.Types.ObjectId(),
      vendorId: vendor._id,
      approvalStatus: 'APPROVED',
    });
    const vo = await VendorOrderModel.create({
      parentOrderId: new mongoose.Types.ObjectId(),
      vendorId: vendor._id,
      orderNumber: 'VORD-CONC-1',
      status: 'CONFIRMED',
      items: [
        {
          productId: new mongoose.Types.ObjectId(),
          variantId: new mongoose.Types.ObjectId(),
          quantity: 1,
          unitPrice: 50,
          lineTotal: 50,
        },
      ],
      subtotal: 50,
      shippingFee: 0,
      commissionRate: 0,
      commissionAmount: 0,
      vendorPayoutAmount: 50,
      timeline: [{ status: 'CONFIRMED', at: new Date() }],
    });

    const userId = new mongoose.Types.ObjectId().toString();
    const results = await Promise.allSettled([
      updateVendorOrderStatusForVendor(vendor._id.toString(), vo._id.toString(), 'PROCESSING', userId),
      updateVendorOrderStatusForVendor(vendor._id.toString(), vo._id.toString(), 'PROCESSING', userId),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled').length).toBe(1);
    expect(results.filter((r) => r.status === 'rejected').length).toBe(1);
  });

  it('requires a reason when the vendor cancels an order', async () => {
    const vendor = await VendorModel.create({
      code: 'VC',
      name: 'Cancel Vendor',
      location: { type: 'Point', coordinates: [80.2, 13.08] },
      serviceAreaRadiusKm: 5,
      deliveryRadiusKm: 5,
      serviceAreaWideDelivery: true,
    });
    const vo = await VendorOrderModel.create({
      parentOrderId: new mongoose.Types.ObjectId(),
      vendorId: vendor._id,
      orderNumber: 'VORD-CANCEL-1',
      status: 'CONFIRMED',
      items: [
        {
          productId: new mongoose.Types.ObjectId(),
          variantId: new mongoose.Types.ObjectId(),
          quantity: 1,
          unitPrice: 40,
          lineTotal: 40,
        },
      ],
      subtotal: 40,
      shippingFee: 0,
      commissionRate: 0,
      commissionAmount: 0,
      vendorPayoutAmount: 40,
      timeline: [{ status: 'CONFIRMED', at: new Date() }],
    });
    const userId = new mongoose.Types.ObjectId().toString();

    await expect(
      updateVendorOrderStatusForVendor(vendor._id.toString(), vo._id.toString(), 'CANCELLED', userId),
    ).rejects.toThrow(/reason/i);

    const updated = await updateVendorOrderStatusForVendor(
      vendor._id.toString(),
      vo._id.toString(),
      'CANCELLED',
      userId,
      'Item unavailable',
    );
    expect(updated.status).toBe('CANCELLED');
    expect(updated.timeline.at(-1)?.note).toBe('Item unavailable');
  });
});
