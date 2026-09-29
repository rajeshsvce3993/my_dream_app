import mongoose, { Schema, type Document, type Types } from 'mongoose';

export const DELIVERY_APPROVAL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type DeliveryApprovalStatus = (typeof DELIVERY_APPROVAL_STATUSES)[number];

export const DELIVERY_AVAILABILITY = ['ONLINE', 'OFFLINE'] as const;
export type DeliveryAvailability = (typeof DELIVERY_AVAILABILITY)[number];

export interface IDeliveryPerson {
  userId: Types.ObjectId;
  approvalStatus: DeliveryApprovalStatus;
  availability: DeliveryAvailability;
  onboardingComplete: boolean;
  lastSeenAt?: Date;
  wentOnlineAt?: Date;
  wentOfflineAt?: Date;
  activeOrderId?: Types.ObjectId | null;
  vehicleType?: string;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDeliveryPersonDocument extends IDeliveryPerson, Document {}

const deliveryPersonSchema = new Schema<IDeliveryPersonDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    approvalStatus: { type: String, enum: DELIVERY_APPROVAL_STATUSES, default: 'PENDING', index: true },
    availability: { type: String, enum: DELIVERY_AVAILABILITY, default: 'OFFLINE', index: true },
    onboardingComplete: { type: Boolean, default: false, index: true },
    lastSeenAt: { type: Date, index: true },
    wentOnlineAt: { type: Date },
    wentOfflineAt: { type: Date },
    activeOrderId: { type: Schema.Types.ObjectId, ref: 'Order', default: null, index: true },
    vehicleType: { type: String },
    rejectionReason: { type: String },
  },
  { timestamps: true },
);

deliveryPersonSchema.index({ availability: 1, approvalStatus: 1, activeOrderId: 1 });

export const DeliveryPersonModel = mongoose.model<IDeliveryPersonDocument>('DeliveryPerson', deliveryPersonSchema);
