import { cacheDel, cacheGet, cacheSet } from '../../infrastructure/cache/redis.js';
import { ConfigurationModel } from './configuration.model.js';

const CACHE_TTL = 300;
const CACHE_PREFIX = 'config:';
const MEMORY_TTL_MS = 60_000;
const memoryCache = new Map<string, { value: unknown; expires: number }>();

function readMemory<T>(key: string): T | undefined {
  const hit = memoryCache.get(key);
  if (!hit) return undefined;
  if (hit.expires <= Date.now()) {
    memoryCache.delete(key);
    return undefined;
  }
  return hit.value as T;
}

function writeMemory(key: string, value: unknown): void {
  memoryCache.set(key, { value, expires: Date.now() + MEMORY_TTL_MS });
}

export async function getConfigValue<T>(key: string, defaultValue?: T): Promise<T> {
  const remembered = readMemory<T>(key);
  if (remembered !== undefined) return remembered;

  const cacheKey = `${CACHE_PREFIX}${key}`;
  const cached = await cacheGet<T>(cacheKey);
  if (cached !== null) {
    writeMemory(key, cached);
    return cached;
  }

  const doc = await ConfigurationModel.findOne({ key }).lean();
  if (!doc) {
    if (defaultValue !== undefined) {
      writeMemory(key, defaultValue);
      return defaultValue;
    }
    throw new Error(`Configuration key not found: ${key}`);
  }
  writeMemory(key, doc.value);
  await cacheSet(cacheKey, doc.value, CACHE_TTL);
  return doc.value as T;
}

export async function getPublicConfiguration(): Promise<Record<string, unknown>> {
  const cacheKey = `${CACHE_PREFIX}public:all`;
  const remembered = readMemory<Record<string, unknown>>(cacheKey);
  if (remembered) return remembered;
  const cached = await cacheGet<Record<string, unknown>>(cacheKey);
  if (cached) {
    writeMemory(cacheKey, cached);
    return cached;
  }

  const docs = await ConfigurationModel.find({ isPublic: true }).lean();
  const result: Record<string, unknown> = {};
  for (const doc of docs) {
    result[doc.key] = doc.value;
  }
  await cacheSet(cacheKey, result, CACHE_TTL);
  writeMemory(cacheKey, result);
  return result;
}

export async function setConfigValue(key: string, value: unknown, updatedBy?: string): Promise<void> {
  memoryCache.delete(key);
  memoryCache.delete(`${CACHE_PREFIX}public:all`);
  await ConfigurationModel.findOneAndUpdate(
    { key },
    { value, updatedBy },
    { upsert: false, new: true },
  );
  await cacheSet(`${CACHE_PREFIX}${key}`, value, CACHE_TTL);
  writeMemory(key, value);
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
