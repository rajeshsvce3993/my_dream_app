import { CustomerAddressModel } from './customerAddress.model.js';
import { CustomerModel } from './customer.model.js';
import { UserModel } from '../users/user.model.js';

function isGenericFirstName(name?: string | null): boolean {
  if (!name?.trim()) return true;
  return name.trim().toLowerCase() === 'customer';
}

/** Name shown in app header — user profile or default saved address. */
export async function resolveCustomerDisplayName(userId: string): Promise<string> {
  const user = await UserModel.findById(userId).lean();
  if (!user) return 'Customer';

  if (!isGenericFirstName(user.firstName)) {
    return user.lastName ? `${user.firstName} ${user.lastName}`.trim() : user.firstName;
  }

  const customer = await CustomerModel.findOne({ userId: user._id });
  if (customer) {
    const addr =
      (await CustomerAddressModel.findOne({ customerId: customer._id, isDefault: true }).lean()) ??
      (await CustomerAddressModel.findOne({ customerId: customer._id }).sort({ createdAt: 1 }).lean());
    if (addr?.fullName?.trim()) {
      return addr.fullName.trim();
    }
  }

  return user.firstName?.trim() || 'Customer';
}

export async function updateUserFirstNameFromProfile(userId: string, firstName: string): Promise<void> {
  const trimmed = firstName.trim();
  if (trimmed.length < 2) return;
  await UserModel.updateOne({ _id: userId }, { firstName: trimmed });
}
