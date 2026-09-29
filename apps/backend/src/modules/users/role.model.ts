import mongoose, { Schema, type Document } from 'mongoose';

export interface IRole {
  code: string;
  name: string;
  description?: string;
  permissionCodes: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRoleDocument extends IRole, Document {}

const roleSchema = new Schema<IRoleDocument>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String },
    permissionCodes: { type: [String], default: [], index: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const RoleModel = mongoose.model<IRoleDocument>('Role', roleSchema);
