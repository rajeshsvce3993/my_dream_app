import mongoose from 'mongoose';
import { InventoryError, NotFoundError } from '../../common/errors/AppError.js';
import { InventoryHistoryModel } from './inventoryHistory.model.js';
import { InventoryModel } from './inventory.model.js';

function withSession(session?: mongoose.ClientSession | null) {
  return session ? { session } : {};
}

export async function reserveInventory(
  session: mongoose.ClientSession | null,
  vendorId: string,
  variantId: string,
  quantity: number,
  reference: { type: string; id: string },
): Promise<void> {
  const result = await InventoryModel.findOneAndUpdate(
    {
      vendorId,
      variantId,
      available: { $gte: quantity },
    },
    {
      $inc: { available: -quantity, reserved: quantity, version: 1 },
    },
    { new: true, ...withSession(session) },
  );

  if (!result) {
    throw new InventoryError('Insufficient stock');
  }

  await InventoryHistoryModel.create(
    [
      {
        vendorId,
        variantId,
        changeType: 'RESERVATION',
        quantityDelta: -quantity,
        availableAfter: result.available,
        reservedAfter: result.reserved,
        referenceType: reference.type,
        referenceId: reference.id,
      },
    ],
    withSession(session),
  );
}

export async function releaseInventory(
  session: mongoose.ClientSession | null,
  vendorId: string,
  variantId: string,
  quantity: number,
  reference: { type: string; id: string },
): Promise<void> {
  const result = await InventoryModel.findOneAndUpdate(
    { vendorId, variantId, reserved: { $gte: quantity } },
    { $inc: { available: quantity, reserved: -quantity, version: 1 } },
    { new: true, ...withSession(session) },
  );
  if (!result) throw new InventoryError('Cannot release inventory');

  await InventoryHistoryModel.create(
    [
      {
        vendorId,
        variantId,
        changeType: 'RELEASE',
        quantityDelta: quantity,
        availableAfter: result.available,
        reservedAfter: result.reserved,
        referenceType: reference.type,
        referenceId: reference.id,
      },
    ],
    withSession(session),
  );
}

export async function confirmSaleFromReservation(
  session: mongoose.ClientSession | null,
  vendorId: string,
  variantId: string,
  quantity: number,
  reference: { type: string; id: string },
): Promise<void> {
  const result = await InventoryModel.findOneAndUpdate(
    { vendorId, variantId, reserved: { $gte: quantity } },
    { $inc: { reserved: -quantity, sold: quantity, version: 1 } },
    { new: true, ...withSession(session) },
  );
  if (!result) throw new InventoryError('Invalid reservation state');

  await InventoryHistoryModel.create(
    [
      {
        vendorId,
        variantId,
        changeType: 'SALE',
        quantityDelta: -quantity,
        availableAfter: result.available,
        reservedAfter: result.reserved,
        referenceType: reference.type,
        referenceId: reference.id,
      },
    ],
    withSession(session),
  );
}

export async function getAvailableStock(vendorId: string, variantId: string): Promise<number> {
  const inv = await InventoryModel.findOne({ vendorId, variantId }).lean();
  if (!inv) throw new NotFoundError('Inventory not found');
  return inv.available;
}
