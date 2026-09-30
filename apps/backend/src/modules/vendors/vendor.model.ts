import mongoose, { Schema, type Document } from 'mongoose';
import type { VendorOnboardingDocuments } from '../onboarding/onboardingDocuments.js';

export interface IVendor {
  code: string;
  name: string;
  email?: string;
  phone?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  /** Shop KYC / onboarding gate — each shop is one vendor. */
  onboardingStatus: 'INCOMPLETE' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  onboardingComplete: boolean;
  onboardingRejectionReason?: string;
  documents?: VendorOnboardingDocuments;
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
  /** Cuisine chips: south-indian | chinese | fast-food */
  cuisineTags: string[];
  /** What this restaurant serves — drives veg / non-veg filters. */
  dietType: 'veg' | 'nonveg' | 'both';
  /** Restaurant cover / thumbnail image for customer apps */
  imageUrl?: string;
  operatingHours?: Record<string, { open: string; close: string; closed?: boolean }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IVendorDocument extends IVendor, Document {}

const vendorDocumentsSchema = new Schema(
  {
    ownerName: { type: String, trim: true },
    ownerPhone: { type: String, trim: true },
    ownerPan: { type: String, trim: true, uppercase: true },
    gstin: { type: String, trim: true, uppercase: true },
    gstExempt: { type: Boolean, default: false },
    fssaiLicense: { type: String, trim: true },
    fssaiExpiry: { type: String, trim: true },
    bankAccountName: { type: String, trim: true },
    bankAccountNumber: { type: String, trim: true },
    bankIfsc: { type: String, trim: true, uppercase: true },
    idProofType: { type: String, enum: ['AADHAAR', 'PASSPORT', 'VOTER', 'DL'] },
    idProofNumber: { type: String, trim: true },
    fssaiDocUrl: { type: String, trim: true },
    gstDocUrl: { type: String, trim: true },
    panDocUrl: { type: String, trim: true },
    bankDocUrl: { type: String, trim: true },
    idProofDocUrl: { type: String, trim: true },
    shopPhotoUrl: { type: String, trim: true },
  },
  { _id: false },
);

const vendorSchema = new Schema<IVendorDocument>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true, index: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'], default: 'INACTIVE', index: true },
    onboardingStatus: {
      type: String,
      enum: ['INCOMPLETE', 'PENDING_REVIEW', 'APPROVED', 'REJECTED'],
      default: 'INCOMPLETE',
      index: true,
    },
    onboardingComplete: { type: Boolean, default: false, index: true },
    onboardingRejectionReason: { type: String, trim: true },
    documents: { type: vendorDocumentsSchema },
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
    cuisineTags: { type: [String], default: [], index: true },
    dietType: {
      type: String,
      enum: ['veg', 'nonveg', 'both'],
      default: 'both',
      index: true,
    },
    imageUrl: { type: String, trim: true },
    operatingHours: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

vendorSchema.index({ location: '2dsphere' });

export const VendorModel = mongoose.model<IVendorDocument>('Vendor', vendorSchema);
