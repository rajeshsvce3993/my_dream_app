import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type DeliveryLocation = {
  label: string;
  line1?: string;
  city: string;
  lng: number;
  lat: number;
  country?: string;
};

const STORAGE_KEY = 'freshmart.location';

const defaultLocation: DeliveryLocation = {
  label: 'Anna Nagar, Chennai',
  line1: '#12, 2nd Cross, Anna Nagar',
  city: 'Chennai',
  lng: 80.2707,
  lat: 13.0827,
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
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as DeliveryLocation;
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
