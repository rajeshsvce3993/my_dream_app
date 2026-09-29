import mongoose, { Schema, type Document, type Types } from 'mongoose';

export const DELIVERY_OFFER_STATUSES = ['PENDING', 'ACCEPTED', 'EXPIRED', 'REJECTED', 'CANCELLED'] as const;
export type DeliveryOfferStatus = (typeof DELIVERY_OFFER_STATUSES)[number];

export interface IDeliveryOffer {
  orderId: Types.ObjectId;
  deliveryPersonId: Types.ObjectId;
  status: DeliveryOfferStatus;
  attempt: number;
  expiresAt: Date;
  acceptedAt?: Date;
  rejectedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDeliveryOfferDocument extends IDeliveryOffer, Document {}

const deliveryOfferSchema = new Schema<IDeliveryOfferDocument>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    deliveryPersonId: { type: Schema.Types.ObjectId, ref: 'DeliveryPerson', required: true, index: true },
    status: { type: String, enum: DELIVERY_OFFER_STATUSES, required: true, index: true },
    attempt: { type: Number, required: true, min: 1 },
    expiresAt: { type: Date, required: true, index: true },
    acceptedAt: { type: Date },
    rejectedAt: { type: Date },
  },
  { timestamps: true },
);

/** One open offer per order. */
deliveryOfferSchema.index(
  { orderId: 1 },
  { unique: true, partialFilterExpression: { status: 'PENDING' } },
);

/** One accepted offer per order. */
deliveryOfferSchema.index(
  { orderId: 1 },
  { unique: true, partialFilterExpression: { status: 'ACCEPTED' } },
);

export const DeliveryOfferModel = mongoose.model<IDeliveryOfferDocument>('DeliveryOffer', deliveryOfferSchema);
