import mongoose, { Schema, type Document } from 'mongoose';

export interface IPermission {
  code: string;
  name: string;
  module: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPermissionDocument extends IPermission, Document {}

const permissionSchema = new Schema<IPermissionDocument>(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true },
    module: { type: String, required: true, index: true },
    description: { type: String },
  },
  { timestamps: true },
);

export const PermissionModel = mongoose.model<IPermissionDocument>('Permission', permissionSchema);
