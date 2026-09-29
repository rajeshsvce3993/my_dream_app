import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface ICustomerAddress {
  customerId: Types.ObjectId;
  label: string;
  fullName: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  lng?: number;
  lat?: number;
  phone?: string;
  addressType: 'home' | 'work' | 'other';
  deliveryInstructions?: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICustomerAddressDocument extends ICustomerAddress, Document {}

const customerAddressSchema = new Schema<ICustomerAddressDocument>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    label: { type: String, default: 'Home', trim: true },
    fullName: { type: String, required: true, trim: true, default: 'Customer' },
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true },
    landmark: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true, default: '' },
    postalCode: { type: String, required: true, trim: true, default: '' },
    country: { type: String, default: 'India', trim: true },
    addressType: { type: String, enum: ['home', 'work', 'other'], default: 'home' },
    deliveryInstructions: { type: String, trim: true },
    lng: { type: Number },
    lat: { type: Number },
    phone: { type: String, trim: true },
    isDefault: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

customerAddressSchema.index({ customerId: 1, isDefault: 1 });

export const CustomerAddressModel = mongoose.model<ICustomerAddressDocument>(
  'CustomerAddress',
  customerAddressSchema,
);
