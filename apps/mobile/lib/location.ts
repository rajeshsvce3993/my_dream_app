export type AppLocation = {
  label: string;
  city: string;
  line1: string;
  lng: number;
  lat: number;
  country: string;
  phone?: string;
};

export const DEFAULT_LOCATION: AppLocation = {
  label: 'HSR Layout, Sector 2',
  city: 'Bengaluru',
  line1: 'B-12, Green View Residency, Sector 45',
  lng: 80.2707,
  lat: 13.0827,
  country: 'IN',
  phone: '+91 98765 43210',
};
