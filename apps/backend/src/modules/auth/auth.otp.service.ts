import { randomUUID } from 'crypto';
import { ConflictError } from '../../common/errors/AppError.js';
import { CustomerModel } from '../customers/customer.model.js';
import { customerHasSavedAddress } from '../customers/customer.service.js';
import { normalizePhone, phoneToLoginEmail } from '../otp/phone.util.js';
import { verifyOtp } from '../otp/otp.service.js';
import { RoleModel } from '../users/role.model.js';
import { UserModel, type IUserDocument } from '../users/user.model.js';
import { createSession, hashPassword } from './auth.service.js';
import type { AuthTokens } from './auth.types.js';
import { getOrCreateCustomerId } from '../cart/cart.service.js';

export async function loginOrRegisterWithOtp(input: {
  phone: string;
  otp: string;
  userAgent?: string;
  ip?: string;
}): Promise<{
  user: IUserDocument;
  tokens: AuthTokens;
  needsAddress: boolean;
  isNewUser: boolean;
}> {
  const phone = normalizePhone(input.phone);
  await verifyOtp(phone, input.otp);

  let user = await UserModel.findOne({ phone });
  let isNewUser = false;

  if (!user) {
    const email = phoneToLoginEmail(phone);
    const existingEmail = await UserModel.findOne({ email });
    if (existingEmail) {
      existingEmail.phone = phone;
      existingEmail.phoneVerified = true;
      existingEmail.lastLoginAt = new Date();
      if (!existingEmail.isActive) throw new ConflictError('Account is inactive');
      await existingEmail.save();
      user = existingEmail;
    } else {
      const customerRole = await RoleModel.findOne({ code: 'CUSTOMER' });
      user = await UserModel.create({
        email,
        passwordHash: await hashPassword(randomUUID()),
        firstName: 'Customer',
        phone,
        roleIds: customerRole ? [customerRole._id] : [],
        isActive: true,
        emailVerified: false,
        phoneVerified: true,
      });
      isNewUser = true;
    }
  } else {
    if (!user.isActive) throw new ConflictError('Account is inactive');
    user.phoneVerified = true;
    user.lastLoginAt = new Date();
    await user.save();
  }

  await getOrCreateCustomerId(user._id.toString());
  const customer = await CustomerModel.findOne({ userId: user._id });
  const needsAddress = customer ? !(await customerHasSavedAddress(customer._id.toString())) : true;

  const tokens = await createSession(user, input.userAgent, input.ip);
  return { user, tokens, needsAddress, isNewUser };
}
