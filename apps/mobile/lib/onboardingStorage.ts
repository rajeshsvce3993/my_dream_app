import * as SecureStore from 'expo-secure-store';

const KEY = 'dream_food_onboarding_v1';

export async function readOnboardingComplete(): Promise<boolean> {
  try {
    const v = await SecureStore.getItemAsync(KEY);
    return v === '1';
  } catch {
    return false;
  }
}

export async function markOnboardingComplete(): Promise<void> {
  await SecureStore.setItemAsync(KEY, '1');
}
