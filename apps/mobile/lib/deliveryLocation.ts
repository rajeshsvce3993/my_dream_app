import * as SecureStore from 'expo-secure-store';
import type { AppLocation } from './location';

const KEY = 'deliveryLocation';

export async function saveDeliveryLocation(loc: AppLocation): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(loc));
}

export async function loadDeliveryLocation(): Promise<AppLocation | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AppLocation;
  } catch {
    return null;
  }
}

export function addressToAppLocation(input: {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  lng?: number;
  lat?: number;
  phone?: string;
  label?: string;
}): AppLocation {
  const line1 = [input.line1, input.line2].filter(Boolean).join(', ');
  return {
    label: input.label ?? `${input.city}, ${input.state}`,
    city: input.city,
    line1,
    lng: input.lng ?? 80.2707,
    lat: input.lat ?? 13.0827,
    country: 'IN',
    phone: input.phone,
  };
}
