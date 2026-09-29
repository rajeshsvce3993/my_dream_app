import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IInventory {
  vendorId: Types.ObjectId;
  variantId: Types.ObjectId;
  available: number;
  reserved: number;
  sold: number;
  lowStockThreshold: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IInventoryDocument extends IInventory, Document {}

const inventorySchema = new Schema<IInventoryDocument>(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    variantId: { type: Schema.Types.ObjectId, ref: 'ProductVariant', required: true, index: true },
    available: { type: Number, required: true, min: 0, default: 0 },
    reserved: { type: Number, required: true, min: 0, default: 0 },
    sold: { type: Number, required: true, min: 0, default: 0 },
    lowStockThreshold: { type: Number, default: 5, min: 0 },
    version: { type: Number, default: 0 },
  },
  { timestamps: true },
);

inventorySchema.index({ vendorId: 1, variantId: 1 }, { unique: true });

export const InventoryModel = mongoose.model<IInventoryDocument>('Inventory', inventorySchema);
