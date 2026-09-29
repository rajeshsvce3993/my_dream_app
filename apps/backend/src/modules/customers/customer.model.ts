import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface ICustomer {
  userId: Types.ObjectId;
  preferredLocale: 'en' | 'ta';
  createdAt: Date;
  updatedAt: Date;
}

export interface ICustomerDocument extends ICustomer, Document {}

const customerSchema = new Schema<ICustomerDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    preferredLocale: { type: String, enum: ['en', 'ta'], default: 'en' },
  },
  { timestamps: true },
);

export const CustomerModel = mongoose.model<ICustomerDocument>('Customer', customerSchema);
