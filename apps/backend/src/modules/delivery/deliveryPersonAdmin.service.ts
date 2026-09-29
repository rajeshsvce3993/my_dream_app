import { ConflictError, NotFoundError } from '../../common/errors/AppError.js';
import { hashPassword } from '../auth/auth.service.js';
import { OrderModel } from '../orders/order.model.js';
import { RoleModel } from '../users/role.model.js';
import { UserModel } from '../users/user.model.js';
import { DeliveryPersonModel } from './deliveryPerson.model.js';
import { getEarnings } from './deliveryEarnings.service.js';

export async function createDeliveryPerson(input: {
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  vehicleType?: string;
  approve?: boolean;
}) {
  const existing = await UserModel.findOne({ email: input.email.toLowerCase() });
  if (existing) throw new ConflictError('Email already registered');
  const role = await RoleModel.findOne({ code: 'DELIVERY', isActive: true });
  if (!role) throw new ConflictError('DELIVERY role is missing. Run the database seed.');

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

  const person = await DeliveryPersonModel.create({
    userId: user._id,
    approvalStatus: input.approve ? 'APPROVED' : 'PENDING',
    onboardingComplete: Boolean(input.approve),
    availability: 'OFFLINE',
    vehicleType: input.vehicleType,
  });
  return { user, person };
}

export async function listDeliveryPeople() {
  const people = await DeliveryPersonModel.find().sort({ updatedAt: -1 }).limit(200).lean();
  const users = await UserModel.find({ _id: { $in: people.map((p) => p.userId) } })
    .select('firstName lastName email phone isActive')
    .lean();
  const userMap = new Map(users.map((u) => [u._id.toString(), u]));
  const activeOrders = await OrderModel.find({
    _id: { $in: people.map((p) => p.activeOrderId).filter(Boolean) },
  })
    .select('orderNumber status')
    .lean();
  const orderMap = new Map(activeOrders.map((o) => [o._id.toString(), o]));

  const rows = [];
  for (const person of people) {
    const user = userMap.get(person.userId.toString());
    const earnings = await getEarnings(person.userId.toString());
    const active = person.activeOrderId ? orderMap.get(person.activeOrderId.toString()) : undefined;
    const todayCount = await OrderModel.countDocuments({
      deliveryPersonUserId: person.userId,
      status: 'DELIVERED',
      deliveredAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) },
    });
    rows.push({
      id: person._id,
      userId: person.userId,
      name: [user?.firstName, user?.lastName].filter(Boolean).join(' '),
      email: user?.email,
      phone: user?.phone,
      accountActive: user?.isActive ?? false,
      approvalStatus: person.approvalStatus,
      availability: person.availability,
      onboardingComplete: person.onboardingComplete,
      lastSeenAt: person.lastSeenAt,
      vehicleType: person.vehicleType,
      activeOrder: active ? { id: active._id, orderNumber: active.orderNumber, status: active.status } : null,
      todayDeliveries: todayCount,
      todayEarnings: earnings.today,
    });
  }
  return rows;
}

export async function updateDeliveryPerson(
  id: string,
  patch: {
    approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
    onboardingComplete?: boolean;
    isActive?: boolean;
    vehicleType?: string;
    firstName?: string;
    lastName?: string;
    rejectionReason?: string;
  },
) {
  const person = await DeliveryPersonModel.findById(id);
  if (!person) throw new NotFoundError('Delivery person not found');
  if (patch.approvalStatus) person.approvalStatus = patch.approvalStatus;
  if (patch.onboardingComplete !== undefined) person.onboardingComplete = patch.onboardingComplete;
  if (patch.vehicleType !== undefined) person.vehicleType = patch.vehicleType;
  if (patch.rejectionReason !== undefined) person.rejectionReason = patch.rejectionReason;
  if (patch.approvalStatus === 'REJECTED' || patch.isActive === false) {
    person.availability = 'OFFLINE';
    person.wentOfflineAt = new Date();
  }
  if (patch.approvalStatus === 'APPROVED') person.onboardingComplete = true;
  await person.save();

  const userPatch: Record<string, unknown> = {};
  if (patch.isActive !== undefined) userPatch.isActive = patch.isActive;
  if (patch.firstName) userPatch.firstName = patch.firstName;
  if (patch.lastName !== undefined) userPatch.lastName = patch.lastName;
  if (Object.keys(userPatch).length) {
    await UserModel.updateOne({ _id: person.userId }, { $set: userPatch });
  }
  return person;
}
