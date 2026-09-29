import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IOffer {
  name: string;
  vendorId?: Types.ObjectId | null;
  productId?: Types.ObjectId | null;
  variantId?: Types.ObjectId | null;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  maxDiscountAmount?: number;
  minQuantity?: number;
  startAt: Date;
  endAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IOfferDocument extends IOffer, Document {}

const offerSchema = new Schema<IOfferDocument>(
  {
    name: { type: String, required: true },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', default: null, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', default: null, index: true },
    variantId: { type: Schema.Types.ObjectId, ref: 'ProductVariant', default: null, index: true },
    discountType: { type: String, enum: ['PERCENTAGE', 'FIXED'], required: true },
    discountValue: { type: Number, required: true, min: 0 },
    maxDiscountAmount: { type: Number, min: 0 },
    minQuantity: { type: Number, min: 1 },
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

export const OfferModel = mongoose.model<IOfferDocument>('Offer', offerSchema);
