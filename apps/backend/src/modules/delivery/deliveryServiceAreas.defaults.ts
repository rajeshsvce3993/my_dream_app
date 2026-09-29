/** Used when `delivery.serviceAreas` is not in the database yet (before seed / admin save). */
export const DEFAULT_DELIVERY_SERVICE_AREAS = [
  {
    id: 'chennai-core',
    name: 'Chennai — core',
    latitude: 13.0827,
    longitude: 80.2707,
    radiusKm: 30,
    active: true,
  },
  {
    id: 'bengaluru-hsr',
    name: 'Bengaluru — HSR / Bellandur',
    latitude: 12.9116,
    longitude: 77.6389,
    radiusKm: 12,
    active: true,
  },
  {
    id: 'tiruvallur-home',
    name: 'Tiruvallur & West Chennai',
    latitude: 13.1425869,
    longitude: 79.9186027,
    radiusKm: 25,
    active: true,
  },
];
