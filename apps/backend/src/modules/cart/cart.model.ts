import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface ICartItem {
  vendorId: Types.ObjectId;
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  vendorProductId?: Types.ObjectId;
  quantity: number;
  availabilityPending?: boolean;
}

export interface ICart {
  customerId: Types.ObjectId;
  items: ICartItem[];
  couponCode?: string;
  deliveryLocation?: { type: 'Point'; coordinates: [number, number] };
  updatedAt: Date;
  createdAt: Date;
}

export interface ICartDocument extends ICart, Document {}

const cartSchema = new Schema<ICartDocument>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, unique: true, index: true },
    items: [
      {
        vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
        productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        variantId: { type: Schema.Types.ObjectId, ref: 'ProductVariant', required: true },
        vendorProductId: { type: Schema.Types.ObjectId, ref: 'VendorProduct' },
        quantity: { type: Number, required: true, min: 1 },
        availabilityPending: { type: Boolean, default: false },
      },
    ],
    couponCode: { type: String, trim: true, uppercase: true },
    deliveryLocation: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number] },
    },
  },
  { timestamps: true },
);

export const CartModel = mongoose.model<ICartDocument>('Cart', cartSchema);
