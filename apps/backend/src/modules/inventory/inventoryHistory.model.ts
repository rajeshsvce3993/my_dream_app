import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IInventoryHistory {
  vendorId: Types.ObjectId;
  variantId: Types.ObjectId;
  changeType: string;
  quantityDelta: number;
  availableAfter: number;
  reservedAfter: number;
  referenceType?: string;
  referenceId?: string;
  changedBy?: Types.ObjectId;
  reason?: string;
  createdAt: Date;
}

export interface IInventoryHistoryDocument extends IInventoryHistory, Document {}

const historySchema = new Schema<IInventoryHistoryDocument>(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    variantId: { type: Schema.Types.ObjectId, ref: 'ProductVariant', required: true, index: true },
    changeType: { type: String, required: true, index: true },
    quantityDelta: { type: Number, required: true },
    availableAfter: { type: Number, required: true },
    reservedAfter: { type: Number, required: true },
    referenceType: { type: String, index: true },
    referenceId: { type: String, index: true },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reason: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const InventoryHistoryModel = mongoose.model<IInventoryHistoryDocument>('InventoryHistory', historySchema);
