import mongoose, { Schema, type Document, type Types } from 'mongoose';

export const VENDOR_APPROVAL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type VendorApprovalStatus = (typeof VENDOR_APPROVAL_STATUSES)[number];

export interface IVendorStaff {
  userId: Types.ObjectId;
  vendorId: Types.ObjectId;
  approvalStatus: VendorApprovalStatus;
  acceptingOrders: boolean;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IVendorStaffDocument extends IVendorStaff, Document {}

const vendorStaffSchema = new Schema<IVendorStaffDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true, unique: true, index: true },
    approvalStatus: { type: String, enum: VENDOR_APPROVAL_STATUSES, default: 'PENDING', index: true },
    acceptingOrders: { type: Boolean, default: true, index: true },
    rejectionReason: { type: String },
  },
  { timestamps: true },
);

vendorStaffSchema.index({ vendorId: 1, approvalStatus: 1 });

export const VendorStaffModel = mongoose.model<IVendorStaffDocument>('VendorStaff', vendorStaffSchema);
