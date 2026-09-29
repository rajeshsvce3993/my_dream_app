import mongoose, { Schema, type Document, type Types } from 'mongoose';
import { localizedStringSchema, type LocalizedString } from '../../common/types/locale.js';

export interface ICategory {
  slug: string;
  name: LocalizedString;
  description?: LocalizedString;
  parentId?: Types.ObjectId | null;
  imageUrl?: string;
  sortOrder: number;
  isActive: boolean;
  isFeatured: boolean;
  seo?: { title?: LocalizedString; description?: LocalizedString; keywords?: string[] };
  createdAt: Date;
  updatedAt: Date;
}

export interface ICategoryDocument extends ICategory, Document {}

const localizedSchema = new Schema(
  {
    en: { type: String, required: true },
    ta: { type: String },
  },
  { _id: false },
);

const categorySchema = new Schema<ICategoryDocument>(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: localizedSchema, required: true },
    description: { type: localizedSchema },
    parentId: { type: Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    imageUrl: { type: String },
    sortOrder: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true, index: true },
    isFeatured: { type: Boolean, default: false, index: true },
    seo: {
      title: localizedSchema,
      description: localizedSchema,
      keywords: [String],
    },
  },
  { timestamps: true },
);

categorySchema.pre('validate', function (next) {
  if (this.name && !localizedStringSchema.safeParse(this.name).success) {
    next(new Error('Invalid localized name'));
  } else {
    next();
  }
});

export const CategoryModel = mongoose.model<ICategoryDocument>('Category', categorySchema);
