import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IProductVariant {
  productId: Types.ObjectId;
  sku: string;
  name: { en: string; ta?: string };
  attributes?: Record<string, string>;
  barcode?: string;
  weightGrams?: number;
  status: 'ACTIVE' | 'INACTIVE';
  /** Customer-facing reference MRP for this variant (actual price); vendor offers compare against this. */
  listPrice?: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProductVariantDocument extends IProductVariant, Document {}

const localizedSchema = new Schema({ en: { type: String, required: true }, ta: String }, { _id: false });

const variantSchema = new Schema<IProductVariantDocument>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: localizedSchema, required: true },
    attributes: { type: Map, of: String },
    barcode: { type: String, trim: true },
    weightGrams: { type: Number },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
    listPrice: { type: Number, min: 0 },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const ProductVariantModel = mongoose.model<IProductVariantDocument>('ProductVariant', variantSchema);
