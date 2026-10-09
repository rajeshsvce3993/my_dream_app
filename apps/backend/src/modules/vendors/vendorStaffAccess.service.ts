import { AuthorizationError, NotFoundError } from '../../common/errors/AppError.js';
import { VendorModel } from './vendor.model.js';
import { VendorStaffModel, type IVendorStaffDocument } from './vendorStaff.model.js';

/** Shops with no staff account stay open. A shop closes when every staff account has paused orders. */
export async function vendorIdsAcceptingOrders(vendorIds: string[]): Promise<Set<string>> {
  const ids = [...new Set(vendorIds.filter(Boolean))];
  if (!ids.length) return new Set();
  const rows = await VendorStaffModel.find({ vendorId: { $in: ids } })
    .select('vendorId acceptingOrders')
    .lean();
  const seen = new Map<string, boolean>();
  for (const row of rows) {
    const id = row.vendorId.toString();
    seen.set(id, (seen.get(id) ?? false) || Boolean(row.acceptingOrders));
  }
  const open = new Set<string>();
  for (const id of ids) {
    if (!seen.has(id) || seen.get(id)) open.add(id);
  }
  return open;
}

export async function setShopAcceptingOrders(vendorId: string, acceptingOrders: boolean): Promise<void> {
  await VendorStaffModel.updateMany({ vendorId }, { $set: { acceptingOrders } });
}

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
