import { randomInt } from 'crypto';
import { AuthenticationError, BusinessRuleError } from '../../common/errors/AppError.js';
import { hashPassword, verifyPassword } from '../auth/auth.service.js';
import { getOtpProviderForSettings } from './providers/index.js';
import {
  deleteOtpRecord,
  getOtpCooldownRemaining,
  getOtpRecord,
  saveOtpRecord,
  setOtpCooldown,
} from './otp.store.js';
import { normalizePhone } from './phone.util.js';
import { getResolvedOtpSettings, isTestOtpForSettings } from './otp.settings.service.js';

function generateOtp(settings: Awaited<ReturnType<typeof getResolvedOtpSettings>>): string {
  if (settings.isMockMode) {
    return settings.testOtp;
  }
  let otp = '';
  for (let i = 0; i < settings.otpLength; i++) {
    otp += String(randomInt(0, 10));
  }
  return otp;
}

export async function requestOtp(rawPhone: string): Promise<{
  phone: string;
  resendInSeconds: number;
  expirySeconds: number;
  otpLength: number;
}> {
  const settings = await getResolvedOtpSettings();
  const phone = normalizePhone(rawPhone);
  const cooldown = await getOtpCooldownRemaining(phone);
  if (cooldown > 0) {
    throw new BusinessRuleError(`Please wait ${cooldown} seconds before requesting another OTP`);
  }

  const otp = generateOtp(settings);
  const hash = await hashPassword(otp);
  await saveOtpRecord(
    phone,
    { hash, attempts: 0, createdAt: Date.now() },
    settings.expirySeconds,
  );

  const provider = getOtpProviderForSettings(settings);
  await provider.sendOtp(phone, otp, settings);
  await setOtpCooldown(phone, settings.resendCooldownSeconds);

  return {
    phone,
    resendInSeconds: settings.resendCooldownSeconds,
    expirySeconds: settings.expirySeconds,
    otpLength: settings.otpLength,
  };
}

export async function verifyOtp(rawPhone: string, otpInput: string): Promise<void> {
  const settings = await getResolvedOtpSettings();
  const phone = normalizePhone(rawPhone);
  const otp = otpInput.trim();
  if (!/^\d+$/.test(otp)) {
    throw new AuthenticationError('Invalid OTP');
  }

  if (isTestOtpForSettings(settings, otp)) {
    await deleteOtpRecord(phone);
    return;
  }

  const record = await getOtpRecord(phone);
  if (!record) {
    throw new AuthenticationError('OTP expired or not found. Request a new code.');
  }

  if (record.attempts >= settings.maxAttempts) {
    await deleteOtpRecord(phone);
    throw new AuthenticationError('Too many attempts. Request a new OTP.');
  }

  const ageSeconds = (Date.now() - record.createdAt) / 1000;
  if (ageSeconds > settings.expirySeconds) {
    await deleteOtpRecord(phone);
    throw new AuthenticationError('OTP expired. Request a new code.');
  }

  const valid = await verifyPassword(otp, record.hash);
  if (!valid) {
    record.attempts += 1;
    await saveOtpRecord(phone, record, settings.expirySeconds);
    throw new AuthenticationError('Invalid OTP');
  }

  await deleteOtpRecord(phone);
}
