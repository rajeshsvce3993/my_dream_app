import mongoose, { Schema, type Document, type Types } from 'mongoose';
import type { OrderStatus } from './orderStateMachine.js';

export interface IOrderItem {
  vendorId: Types.ObjectId;
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  quantity: number;
  unitPrice: number;
  taxAmount: number;
  discountAmount: number;
  lineTotal: number;
}

export interface IOrder {
  orderNumber: string;
  customerId: Types.ObjectId;
  status: OrderStatus;
  paymentStatus: 'PENDING' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
  items: IOrderItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  shippingTotal: number;
  grandTotal: number;
  currency: string;
  deliveryAddress: {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode?: string;
    country: string;
    location?: { type: 'Point'; coordinates: [number, number] };
  };
  couponCode?: string;
  idempotencyKey?: string;
  timeline: { status: OrderStatus; at: Date; by?: Types.ObjectId; note?: string }[];
  /** Assigned delivery user. One active assignment per order; enforced by conditional update. */
  deliveryPersonUserId?: Types.ObjectId | null;
  assignedAt?: Date;
  pickedUpAt?: Date;
  deliveredAt?: Date;
  deliveryEarning?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IOrderDocument extends IOrder, Document {}

const orderItemSchema = new Schema<IOrderItem>(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: Schema.Types.ObjectId, ref: 'ProductVariant', required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const orderSchema = new Schema<IOrderDocument>(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    status: { type: String, required: true, index: true },
    paymentStatus: { type: String, required: true, index: true },
    items: { type: [orderItemSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    discountTotal: { type: Number, default: 0, min: 0 },
    taxTotal: { type: Number, required: true, min: 0 },
    shippingTotal: { type: Number, required: true, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    deliveryAddress: {
      line1: { type: String, required: true },
      line2: String,
      city: { type: String, required: true },
      state: String,
      postalCode: String,
      country: { type: String, required: true },
      location: {
        type: { type: String, enum: ['Point'] },
        coordinates: [Number],
      },
    },
    couponCode: { type: String },
    idempotencyKey: { type: String, unique: true, sparse: true },
    timeline: [
      {
        status: { type: String, required: true },
        at: { type: Date, required: true },
        by: { type: Schema.Types.ObjectId, ref: 'User' },
        note: String,
      },
    ],
    deliveryPersonUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    assignedAt: { type: Date },
    pickedUpAt: { type: Date },
    deliveredAt: { type: Date },
    deliveryEarning: { type: Number, min: 0 },
  },
  { timestamps: true },
);

/** At most one in-progress order per delivery person. */
orderSchema.index(
  { deliveryPersonUserId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      deliveryPersonUserId: { $type: 'objectId' },
      status: { $in: ['PACKED', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'] },
    },
  },
);

orderSchema.index({ status: 1, deliveryPersonUserId: 1 });

export const OrderModel = mongoose.model<IOrderDocument>('Order', orderSchema);
