import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IUser {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  roleIds: Types.ObjectId[];
  extraPermissionCodes: string[];
  isActive: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserDocument extends IUser, Document {}

const userSchema = new Schema<IUserDocument>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true },
    phone: { type: String, trim: true, sparse: true, unique: true, index: true },
    roleIds: [{ type: Schema.Types.ObjectId, ref: 'Role', index: true }],
    extraPermissionCodes: { type: [String], default: [] },
    isActive: { type: Boolean, default: true, index: true },
    emailVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

export const UserModel = mongoose.model<IUserDocument>('User', userSchema);
