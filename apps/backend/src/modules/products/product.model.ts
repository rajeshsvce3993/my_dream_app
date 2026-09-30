import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IProduct {
  sku: string;
  slug: string;
  name: { en: string; ta?: string };
  description?: { en: string; ta?: string };
  categoryId: Types.ObjectId;
  subcategoryId?: Types.ObjectId;
  brand?: string;
  images: { url: string; isPrimary: boolean; sortOrder: number }[];
  attributes?: Record<string, string>;
  unit?: string;
  weightGrams?: number;
  taxCategoryId?: Types.ObjectId;
  status: 'DRAFT' | 'ACTIVE' | 'INACTIVE';
  /** Food diet marker for veg / non-veg filters. */
  dietType?: 'veg' | 'nonveg';
  searchKeywords?: string[];
  seo?: { title?: { en?: string; ta?: string }; description?: { en?: string; ta?: string } };
  createdAt: Date;
  updatedAt: Date;
}

export interface IProductDocument extends IProduct, Document {}

const localizedSchema = new Schema({ en: { type: String, required: true }, ta: String }, { _id: false });

const productSchema = new Schema<IProductDocument>(
  {
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: localizedSchema, required: true },
    description: { type: localizedSchema },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    subcategoryId: { type: Schema.Types.ObjectId, ref: 'Category', index: true },
    brand: { type: String, trim: true, index: true },
    images: [
      {
        url: { type: String, required: true },
        isPrimary: { type: Boolean, default: false },
        sortOrder: { type: Number, default: 0 },
      },
    ],
    attributes: { type: Map, of: String },
    unit: { type: String },
    weightGrams: { type: Number },
    taxCategoryId: { type: Schema.Types.ObjectId, ref: 'TaxCategory' },
    status: { type: String, enum: ['DRAFT', 'ACTIVE', 'INACTIVE'], default: 'DRAFT', index: true },
    dietType: { type: String, enum: ['veg', 'nonveg'], index: true },
    searchKeywords: [{ type: String }],
    seo: {
      title: localizedSchema,
      description: localizedSchema,
    },
  },
  { timestamps: true },
);

productSchema.index({ 'name.en': 'text', 'name.ta': 'text', sku: 'text', brand: 'text', searchKeywords: 'text' });

export const ProductModel = mongoose.model<IProductDocument>('Product', productSchema);
