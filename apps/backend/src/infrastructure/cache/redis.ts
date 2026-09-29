import { Redis } from 'ioredis';
import { env } from '../../config/env.js';
import { logger } from '../logging/logger.js';

let redis: Redis | null = null;
let redisEnabled = false;
let lastErrorLoggedAt = 0;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });
    redis.on('error', (err: Error) => {
      const now = Date.now();
      if (now - lastErrorLoggedAt > 30_000) {
        lastErrorLoggedAt = now;
        logger.warn({ err: err.message }, 'Redis unavailable');
      }
    });
  }
  return redis;
}

export async function connectRedis(): Promise<void> {
  const client = getRedis();
  if (client.status === 'ready') {
    redisEnabled = true;
    return;
  }
  await client.connect();
  redisEnabled = true;
  logger.info('Redis connected');
}

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    try {
      redis.disconnect();
    } catch {
      // ignore
    }
    redis = null;
  }
  redisEnabled = false;
}

export function getRedisReady(): boolean {
  return redisEnabled && redis?.status === 'ready';
}

function cacheEnabled(): boolean {
  return getRedisReady();
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!cacheEnabled()) return null;
  const raw = await getRedis().get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  if (!cacheEnabled()) return;
  const payload = JSON.stringify(value);
  if (ttlSeconds) {
    await getRedis().setex(key, ttlSeconds, payload);
  } else {
    await getRedis().set(key, payload);
  }
}

export async function cacheDel(pattern: string): Promise<void> {
  if (!cacheEnabled()) return;
  const client = getRedis();
  const stream = client.scanStream({ match: pattern, count: 100 });
  const pipeline = client.pipeline();
  let batch = 0;
  for await (const keys of stream) {
    for (const key of keys as string[]) {
      pipeline.del(key);
      batch++;
    }
    if (batch >= 100) {
      await pipeline.exec();
      batch = 0;
    }
  }
  if (batch > 0) await pipeline.exec();
}
