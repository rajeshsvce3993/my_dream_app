import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface INotification {
  userId: Types.ObjectId;
  channel: 'IN_APP' | 'EMAIL' | 'SMS' | 'PUSH';
  event: string;
  title: { en: string; ta?: string };
  body: { en: string; ta?: string };
  data?: Record<string, unknown>;
  readAt?: Date | null;
  createdAt: Date;
}

export interface INotificationDocument extends INotification, Document {}

const localizedSchema = new Schema({ en: String, ta: String }, { _id: false });

const notificationSchema = new Schema<INotificationDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    channel: { type: String, enum: ['IN_APP', 'EMAIL', 'SMS', 'PUSH'], required: true },
    event: { type: String, required: true, index: true },
    title: { type: localizedSchema, required: true },
    body: { type: localizedSchema, required: true },
    data: { type: Schema.Types.Mixed },
    readAt: { type: Date, default: null, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const NotificationModel = mongoose.model<INotificationDocument>('Notification', notificationSchema);
