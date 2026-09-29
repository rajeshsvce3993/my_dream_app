import { ConflictError, NotFoundError } from '../../common/errors/AppError.js';
import { hashPassword } from '../auth/auth.service.js';
import { RoleModel } from '../users/role.model.js';
import { UserModel } from '../users/user.model.js';
import { VendorModel } from './vendor.model.js';
import { VendorStaffModel } from './vendorStaff.model.js';
import { getVendorHomeStats } from './vendorOrderPortal.service.js';

export async function createVendorStaff(input: {
  vendorId: string;
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  approve?: boolean;
}) {
  const vendor = await VendorModel.findById(input.vendorId);
  if (!vendor) throw new NotFoundError('Vendor not found');

  const existing = await UserModel.findOne({ email: input.email.toLowerCase() });
  if (existing) throw new ConflictError('Email already registered');

  const role = await RoleModel.findOne({ code: 'VENDOR', isActive: true });
  if (!role) throw new ConflictError('VENDOR role is missing. Run the database seed.');

  const user = await UserModel.create({
    email: input.email.toLowerCase(),
    passwordHash: await hashPassword(input.password),
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    roleIds: [role._id],
    isActive: true,
    emailVerified: true,
  });

  const staff = await VendorStaffModel.create({
    userId: user._id,
    vendorId: vendor._id,
    approvalStatus: input.approve ? 'APPROVED' : 'PENDING',
    acceptingOrders: true,
  });

  return { user, staff, vendor };
}

export async function listVendorStaffAccounts() {
  const staffRows = await VendorStaffModel.find().sort({ updatedAt: -1 }).limit(200).lean();
  const users = await UserModel.find({ _id: { $in: staffRows.map((s) => s.userId) } })
    .select('firstName lastName email phone isActive')
    .lean();
  const vendors = await VendorModel.find({ _id: { $in: staffRows.map((s) => s.vendorId) } })
    .select('name code status')
    .lean();

  const userMap = new Map(users.map((u) => [u._id.toString(), u]));
  const vendorMap = new Map(vendors.map((v) => [v._id.toString(), v]));

  const rows = [];
  for (const staff of staffRows) {
    const user = userMap.get(staff.userId.toString());
    const vendor = vendorMap.get(staff.vendorId.toString());
    const stats = await getVendorHomeStats(staff.vendorId.toString());
    rows.push({
      id: staff._id,
      userId: staff.userId,
      vendorId: staff.vendorId,
      vendorName: vendor?.name,
      vendorCode: vendor?.code,
      vendorStatus: vendor?.status,
      name: [user?.firstName, user?.lastName].filter(Boolean).join(' '),
      email: user?.email,
      phone: user?.phone,
      accountActive: user?.isActive ?? false,
      approvalStatus: staff.approvalStatus,
      acceptingOrders: staff.acceptingOrders,
      newOrders: stats.newOrders,
      activeOrders: stats.activeOrders,
    });
  }
  return rows;
}

export async function updateVendorStaffAccount(
  id: string,
  patch: {
    approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
    acceptingOrders?: boolean;
    isActive?: boolean;
    firstName?: string;
    lastName?: string;
    rejectionReason?: string;
  },
) {
  const staff = await VendorStaffModel.findById(id);
  if (!staff) throw new NotFoundError('Vendor staff not found');

  if (patch.approvalStatus) staff.approvalStatus = patch.approvalStatus;
  if (patch.acceptingOrders !== undefined) staff.acceptingOrders = patch.acceptingOrders;
  if (patch.rejectionReason !== undefined) staff.rejectionReason = patch.rejectionReason;
  await staff.save();

  const user = await UserModel.findById(staff.userId);
  if (user) {
    if (patch.isActive !== undefined) user.isActive = patch.isActive;
    if (patch.firstName) user.firstName = patch.firstName;
    if (patch.lastName !== undefined) user.lastName = patch.lastName;
    await user.save();
  }

  return staff;
}
