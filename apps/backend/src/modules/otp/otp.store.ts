import { cacheDel, cacheGet, cacheSet, getRedisReady } from '../../infrastructure/cache/redis.js';

export type OtpRecord = {
  hash: string;
  attempts: number;
  createdAt: number;
};

const memory = new Map<string, { record: OtpRecord; expiresAt: number }>();
const memoryCooldown = new Map<string, number>();

function otpKey(phone: string): string {
  return `otp:session:${phone}`;
}

function cooldownKey(phone: string): string {
  return `otp:cooldown:${phone}`;
}

function purgeMemory(): void {
  const now = Date.now();
  for (const [key, entry] of memory) {
    if (entry.expiresAt <= now) memory.delete(key);
  }
}

export async function getOtpRecord(phone: string): Promise<OtpRecord | null> {
  const fromRedis = await cacheGet<OtpRecord>(otpKey(phone));
  if (fromRedis) return fromRedis;
  purgeMemory();
  const entry = memory.get(phone);
  if (!entry || entry.expiresAt <= Date.now()) {
    memory.delete(phone);
    return null;
  }
  return entry.record;
}

export async function saveOtpRecord(phone: string, record: OtpRecord, ttlSeconds: number): Promise<void> {
  await cacheSet(otpKey(phone), record, ttlSeconds);
  if (!getRedisReady()) {
    memory.set(phone, { record, expiresAt: Date.now() + ttlSeconds * 1000 });
  }
}

export async function deleteOtpRecord(phone: string): Promise<void> {
  await cacheDel(otpKey(phone));
  memory.delete(phone);
}

export async function getOtpCooldownRemaining(phone: string): Promise<number> {
  if (getRedisReady()) {
    const { getRedis } = await import('../../infrastructure/cache/redis.js');
    const ttl = await getRedis().ttl(cooldownKey(phone));
    return ttl > 0 ? ttl : 0;
  }
  const until = memoryCooldown.get(phone);
  if (!until) return 0;
  const remaining = Math.ceil((until - Date.now()) / 1000);
  if (remaining <= 0) {
    memoryCooldown.delete(phone);
    return 0;
  }
  return remaining;
}

export async function setOtpCooldown(phone: string, seconds: number): Promise<void> {
  if (getRedisReady()) {
    const { getRedis } = await import('../../infrastructure/cache/redis.js');
    await getRedis().setex(cooldownKey(phone), seconds, '1');
    return;
  }
  memoryCooldown.set(phone, Date.now() + seconds * 1000);
}

export function clearOtpStoreForTests(): void {
  memory.clear();
  memoryCooldown.clear();
}
