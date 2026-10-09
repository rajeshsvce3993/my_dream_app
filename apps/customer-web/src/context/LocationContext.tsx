import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type DeliveryLocation = {
  label: string;
  line1?: string;
  city: string;
  lng: number;
  lat: number;
  country?: string;
};

const STORAGE_KEY = 'dreamfood.location';

const defaultLocation: DeliveryLocation = {
  label: 'Tiruvallur, Home',
  line1: 'Near Tiruvallur Railway Station',
  city: 'Tiruvallur',
  lng: 79.9186027,
  lat: 13.1425869,
  country: 'IN',
};

type LocationContextValue = {
  location: DeliveryLocation;
  setLocation: (loc: DeliveryLocation) => void;
  query: { lng: number; lat: number };
};

const LocationContext = createContext<LocationContextValue | null>(null);

function readStored(): DeliveryLocation {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem('freshmart.location');
    if (raw) {
      const parsed = JSON.parse(raw) as DeliveryLocation;
      const retired =
        Math.abs(parsed.lng - 80.2707) < 0.0001 && Math.abs(parsed.lat - 13.0827) < 0.0001;
      if (retired) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultLocation));
        return defaultLocation;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return defaultLocation;
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocationState] = useState<DeliveryLocation>(readStored);

  const setLocation = (loc: DeliveryLocation) => {
    setLocationState(loc);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
  };

  const value = useMemo(
    () => ({
      location,
      setLocation,
      query: { lng: location.lng, lat: location.lat },
    }),
    [location],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocationContext() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocationContext must be used within LocationProvider');
  return ctx;
}
