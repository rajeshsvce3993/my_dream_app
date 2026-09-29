import { AuthorizationError, NotFoundError } from '../../common/errors/AppError.js';
import { VendorModel } from './vendor.model.js';
import { VendorStaffModel, type IVendorStaffDocument } from './vendorStaff.model.js';

export async function getVendorStaffByUserId(userId: string): Promise<IVendorStaffDocument> {
  const staff = await VendorStaffModel.findOne({ userId });
  if (!staff) throw new NotFoundError('Vendor account not found');
  return staff;
}

export async function requireOperationalVendorStaff(userId: string): Promise<{
  staff: IVendorStaffDocument;
  vendorId: string;
}> {
  const staff = await getVendorStaffByUserId(userId);
  if (staff.approvalStatus !== 'APPROVED') {
    throw new AuthorizationError('Vendor account is not approved');
  }
  const vendor = await VendorModel.findById(staff.vendorId);
  if (!vendor) throw new NotFoundError('Vendor not found');
  if (vendor.status !== 'ACTIVE') {
    throw new AuthorizationError('Shop is not active');
  }
  return { staff, vendorId: staff.vendorId.toString() };
}
