import * as Location from 'expo-location';
import { Linking } from 'react-native';

const LOCATION_TIMEOUT_MS = 12_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

export async function readCurrentCoordinates(): Promise<{ latitude: number; longitude: number }> {
  const current = await Location.getForegroundPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') {
    const requested = await Location.requestForegroundPermissionsAsync();
    status = requested.status;
    if (status !== 'granted' && requested.canAskAgain === false) {
      await Linking.openSettings();
    }
  }
  if (status !== 'granted') {
    throw new Error('Location permission is required to go online.');
  }

  const lastKnown = await Location.getLastKnownPositionAsync();
  const fresh = await withTimeout(
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
    LOCATION_TIMEOUT_MS,
  );
  const position = fresh ?? lastKnown;
  if (!position) {
    throw new Error('Could not read your location. Turn on GPS and try again.');
  }
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
}
