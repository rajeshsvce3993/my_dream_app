import mongoose, { Schema, type Document, type Types } from 'mongoose';

export type PaymentStatus =
  | 'INITIATED'
  | 'AUTHORIZED'
  | 'CAPTURED'
  | 'FAILED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export interface IPayment {
  orderId: Types.ObjectId;
  provider: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  providerReference?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPaymentDocument extends IPayment, Document {}

const paymentSchema = new Schema<IPaymentDocument>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    provider: { type: String, required: true },
    status: { type: String, required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true },
    providerReference: { type: String, index: true },
    idempotencyKey: { type: String, unique: true, sparse: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

export const PaymentModel = mongoose.model<IPaymentDocument>('Payment', paymentSchema);
