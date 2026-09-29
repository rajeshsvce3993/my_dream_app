import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IVendorProduct {
  vendorId: Types.ObjectId;
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  vendorSku?: string;
  vendorPrice: number;
  mrp: number;
  sellingPrice: number;
  isActive: boolean;
  preparationMinutes?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IVendorProductDocument extends IVendorProduct, Document {}

const vendorProductSchema = new Schema<IVendorProductDocument>(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    variantId: { type: Schema.Types.ObjectId, ref: 'ProductVariant', required: true, index: true },
    vendorSku: { type: String, trim: true },
    vendorPrice: { type: Number, required: true, min: 0 },
    mrp: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
    preparationMinutes: { type: Number, min: 0 },
  },
  { timestamps: true },
);

vendorProductSchema.index({ vendorId: 1, variantId: 1 }, { unique: true });
vendorProductSchema.index({ vendorId: 1, productId: 1 });
vendorProductSchema.index({ productId: 1, variantId: 1, isActive: 1 });
vendorProductSchema.index({ vendorId: 1, isActive: 1 });

export const VendorProductModel = mongoose.model<IVendorProductDocument>('VendorProduct', vendorProductSchema);
