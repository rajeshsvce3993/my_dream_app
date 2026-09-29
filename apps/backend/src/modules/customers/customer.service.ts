import { NotFoundError } from '../../common/errors/AppError.js';
import { updateUserFirstNameFromProfile } from './customerProfile.service.js';
import { CustomerAddressModel } from './customerAddress.model.js';
import { CustomerModel } from './customer.model.js';

export async function customerHasSavedAddress(customerId: string): Promise<boolean> {
  const count = await CustomerAddressModel.countDocuments({ customerId });
  return count > 0;
}

const labelFromType = (t: 'home' | 'work' | 'other') =>
  t === 'home' ? 'Home' : t === 'work' ? 'Work' : 'Other';

export async function createCustomerAddress(input: {
  userId: string;
  fullName: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  lng?: number;
  lat?: number;
  phone?: string;
  addressType?: 'home' | 'work' | 'other';
  deliveryInstructions?: string;
  label?: string;
}) {
  const customer = await CustomerModel.findOne({ userId: input.userId });
  if (!customer) throw new NotFoundError('Customer profile not found');

  const existing = await CustomerAddressModel.countDocuments({ customerId: customer._id });
  const addressType = input.addressType ?? 'home';
  const address = await CustomerAddressModel.create({
    customerId: customer._id,
    label: input.label ?? labelFromType(addressType),
    fullName: input.fullName.trim(),
    line1: input.line1.trim(),
    line2: input.line2?.trim(),
    landmark: input.landmark?.trim(),
    city: input.city.trim(),
    state: input.state.trim(),
    postalCode: input.postalCode.trim(),
    country: input.country ?? 'India',
    lng: input.lng,
    lat: input.lat,
    phone: input.phone?.trim(),
    addressType,
    deliveryInstructions: input.deliveryInstructions?.trim(),
    isDefault: existing === 0,
  });
  await updateUserFirstNameFromProfile(input.userId, input.fullName);
  return address;
}

export async function listCustomerAddresses(userId: string) {
  const customer = await CustomerModel.findOne({ userId });
  if (!customer) return [];
  return CustomerAddressModel.find({ customerId: customer._id }).sort({ isDefault: -1, createdAt: -1 }).lean();
}
