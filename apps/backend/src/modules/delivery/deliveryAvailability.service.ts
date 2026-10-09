import { AuthorizationError, BusinessRuleError, NotFoundError } from '../../common/errors/AppError.js';
import { UserModel } from '../users/user.model.js';
import { DeliveryPersonModel, type IDeliveryPersonDocument } from './deliveryPerson.model.js';
import {
  getDeliveryServiceAreas,
  isPointWithinRiderReach,
} from './deliveryServiceAreas.service.js';

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

export async function setAvailability(
  userId: string,
  next: 'ONLINE' | 'OFFLINE',
  coords?: { latitude: number; longitude: number },
) {
  const person = await getDeliveryPersonByUserId(userId);
  if (next === 'ONLINE') {
    await assertCanGoOnline(person);
    if (coords?.latitude == null || coords.longitude == null) {
      throw new BusinessRuleError('Turn on location to go online');
    }
    await applyRiderLocation(person, coords.longitude, coords.latitude, true);
  }
  const now = new Date();
  person.availability = next;
  person.lastSeenAt = now;
  if (next === 'ONLINE') person.wentOnlineAt = now;
  else person.wentOfflineAt = now;
  await person.save();
  return person;
}

/** Refresh GPS while the rider is online. Orders are matched from this point. */
export async function updateRiderLocation(
  userId: string,
  coords: { latitude: number; longitude: number },
) {
  const person = await getDeliveryPersonByUserId(userId);
  if (person.availability !== 'ONLINE') {
    throw new BusinessRuleError('Go online before sharing location');
  }
  await applyRiderLocation(person, coords.longitude, coords.latitude, false);
  person.lastSeenAt = new Date();
  await person.save();
  return person;
}

async function applyRiderLocation(
  person: IDeliveryPersonDocument,
  lng: number,
  lat: number,
  requireInsideZone: boolean,
) {
  const areas = await getDeliveryServiceAreas();
  const matched = areas.filter((area) => isPointWithinRiderReach(lng, lat, area));
  if (areas.length && requireInsideZone && matched.length === 0) {
    throw new BusinessRuleError(
      'You are farther outside every launch area than that zone allows. Move closer to go online.',
    );
  }
  person.currentLocation = { type: 'Point', coordinates: [lng, lat] };
  person.locationUpdatedAt = new Date();
  person.serviceAreaIds = matched.map((area) => area.id);
}

export async function touchLastSeen(userId: string): Promise<void> {
  await DeliveryPersonModel.updateOne({ userId }, { $set: { lastSeenAt: new Date() } });
}
