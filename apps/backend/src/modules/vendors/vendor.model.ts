import mongoose, { Schema, type Document } from 'mongoose';

export interface IVendor {
  code: string;
  name: string;
  email?: string;
  phone?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  rating: number;
  ratingCount: number;
  commissionRate: number;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  serviceAreaRadiusKm: number;
  deliveryRadiusKm: number;
  /**
   * When true, vendor is available to any customer inside the platform service area
   * (no per-store delivery radius filter). Customer must still be in an allowed zone.
   */
  serviceAreaWideDelivery: boolean;
  operatingHours?: Record<string, { open: string; close: string; closed?: boolean }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IVendorDocument extends IVendor, Document {}

const vendorSchema = new Schema<IVendorDocument>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true, index: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'], default: 'ACTIVE', index: true },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0 },
    commissionRate: { type: Number, default: 0, min: 0, max: 100 },
    address: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },
    location: {
      type: { type: String, enum: ['Point'], required: true, default: 'Point' },
      coordinates: { type: [Number], required: true },
    },
    serviceAreaRadiusKm: { type: Number, default: 10, min: 0 },
    deliveryRadiusKm: { type: Number, default: 15, min: 0 },
    serviceAreaWideDelivery: { type: Boolean, default: false },
    operatingHours: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

vendorSchema.index({ location: '2dsphere' });

export const VendorModel = mongoose.model<IVendorDocument>('Vendor', vendorSchema);
