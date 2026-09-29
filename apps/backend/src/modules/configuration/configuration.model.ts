import mongoose, { Schema, type Document } from 'mongoose';

export interface IConfiguration {
  key: string;
  value: unknown;
  category: string;
  description?: string;
  isPublic: boolean;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IConfigurationDocument extends IConfiguration, Document {}

const configurationSchema = new Schema<IConfigurationDocument>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    value: { type: Schema.Types.Mixed, required: true },
    category: { type: String, required: true, index: true },
    description: { type: String },
    isPublic: { type: Boolean, default: false, index: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const ConfigurationModel = mongoose.model<IConfigurationDocument>('Configuration', configurationSchema);
