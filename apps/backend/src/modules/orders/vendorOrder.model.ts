import mongoose, { Schema, type Document, type Types } from 'mongoose';
import type { OrderStatus } from './orderStateMachine.js';

export interface IVendorOrderItem {
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  taxAmount?: number;
}

export interface IVendorOrder {
  parentOrderId: Types.ObjectId;
  vendorId: Types.ObjectId;
  orderNumber: string;
  status: OrderStatus;
  items: IVendorOrderItem[];
  subtotal: number;
  shippingFee: number;
  commissionRate: number;
  commissionAmount: number;
  vendorPayoutAmount: number;
  vendorPayoutPaidAt?: Date;
  trackingNumber?: string;
  timeline: { status: OrderStatus; at: Date; note?: string }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IVendorOrderDocument extends IVendorOrder, Document {}

const vendorOrderSchema = new Schema<IVendorOrderDocument>(
  {
    parentOrderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    orderNumber: { type: String, required: true, unique: true, index: true },
    status: { type: String, required: true, index: true },
    items: [
      {
        productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        variantId: { type: Schema.Types.ObjectId, ref: 'ProductVariant', required: true },
        quantity: { type: Number, required: true, min: 1 },
        unitPrice: { type: Number, required: true, min: 0 },
        lineTotal: { type: Number, required: true, min: 0 },
        taxAmount: { type: Number, default: 0, min: 0 },
      },
    ],
    subtotal: { type: Number, required: true, min: 0 },
    shippingFee: { type: Number, default: 0, min: 0 },
    commissionRate: { type: Number, default: 0, min: 0 },
    commissionAmount: { type: Number, default: 0, min: 0 },
    vendorPayoutAmount: { type: Number, default: 0, min: 0 },
    vendorPayoutPaidAt: { type: Date },
    trackingNumber: { type: String },
    timeline: [
      {
        status: { type: String, required: true },
        at: { type: Date, required: true },
        note: String,
      },
    ],
  },
  { timestamps: true },
);

export const VendorOrderModel = mongoose.model<IVendorOrderDocument>('VendorOrder', vendorOrderSchema);
