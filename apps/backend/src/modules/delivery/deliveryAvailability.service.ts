import { AuthorizationError, BusinessRuleError, NotFoundError } from '../../common/errors/AppError.js';
import { UserModel } from '../users/user.model.js';
import { DeliveryPersonModel, type IDeliveryPersonDocument } from './deliveryPerson.model.js';

export async function getDeliveryPersonByUserId(userId: string): Promise<IDeliveryPersonDocument> {
  const person = await DeliveryPersonModel.findOne({ userId });
  if (!person) throw new NotFoundError('Delivery profile not found');
  return person;
}

export async function assertCanGoOnline(person: IDeliveryPersonDocument): Promise<void> {
  const user = await UserModel.findById(person.userId);
  if (!user || !user.isActive) throw new AuthorizationError('Account is inactive');
  if (person.approvalStatus !== 'APPROVED') {
    throw new BusinessRuleError('Account is not approved for deliveries');
  }
  if (!person.onboardingComplete) {
    throw new BusinessRuleError('Onboarding is not complete');
  }
}

export async function setAvailability(userId: string, next: 'ONLINE' | 'OFFLINE') {
  const person = await getDeliveryPersonByUserId(userId);
  if (next === 'ONLINE') await assertCanGoOnline(person);
  const now = new Date();
  person.availability = next;
  person.lastSeenAt = now;
  if (next === 'ONLINE') person.wentOnlineAt = now;
  else person.wentOfflineAt = now;
  await person.save();
  return person;
}

export async function touchLastSeen(userId: string): Promise<void> {
  await DeliveryPersonModel.updateOne({ userId }, { $set: { lastSeenAt: new Date() } });
}
