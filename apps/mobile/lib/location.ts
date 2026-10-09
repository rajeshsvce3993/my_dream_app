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
  label: 'Tiruvallur, Home',
  city: 'Tiruvallur',
  line1: 'Near Tiruvallur Railway Station',
  lng: 79.9186027,
  lat: 13.1425869,
  country: 'IN',
  phone: '+91 98765 43210',
};
