import { cacheDel, cacheGet, cacheSet } from '../../infrastructure/cache/redis.js';
import { ConfigurationModel } from './configuration.model.js';

const CACHE_TTL = 300;
const CACHE_PREFIX = 'config:';

export async function getConfigValue<T>(key: string, defaultValue?: T): Promise<T> {
  const cacheKey = `${CACHE_PREFIX}${key}`;
  const cached = await cacheGet<T>(cacheKey);
  if (cached !== null) return cached;

  const doc = await ConfigurationModel.findOne({ key }).lean();
  if (!doc) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Configuration key not found: ${key}`);
  }
  await cacheSet(cacheKey, doc.value, CACHE_TTL);
  return doc.value as T;
}

export async function getPublicConfiguration(): Promise<Record<string, unknown>> {
  const cacheKey = `${CACHE_PREFIX}public:all`;
  const cached = await cacheGet<Record<string, unknown>>(cacheKey);
  if (cached) return cached;

  const docs = await ConfigurationModel.find({ isPublic: true }).lean();
  const result: Record<string, unknown> = {};
  for (const doc of docs) {
    result[doc.key] = doc.value;
  }
  await cacheSet(cacheKey, result, CACHE_TTL);
  return result;
}

export async function setConfigValue(key: string, value: unknown, updatedBy?: string): Promise<void> {
  await ConfigurationModel.findOneAndUpdate(
    { key },
    { value, updatedBy },
    { upsert: false, new: true },
  );
  await cacheSet(`${CACHE_PREFIX}${key}`, value, CACHE_TTL);
  await cacheDel(`${CACHE_PREFIX}*`);
}

export interface VendorRankingWeights {
  priceWeight: number;
  distanceWeight: number;
  ratingWeight: number;
  availabilityWeight: number;
}

export async function getVendorRankingWeights(): Promise<VendorRankingWeights> {
  return getConfigValue<VendorRankingWeights>('vendor.ranking.weights', {
    priceWeight: 0.4,
    distanceWeight: 0.3,
    ratingWeight: 0.2,
    availabilityWeight: 0.1,
  });
}
