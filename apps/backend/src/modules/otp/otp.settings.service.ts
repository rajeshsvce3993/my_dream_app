import mongoose from 'mongoose';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { BusinessRuleError } from '../../common/errors/AppError.js';
import { ConfigurationModel } from '../configuration/configuration.model.js';
import { getConfigValue } from '../configuration/configuration.service.js';
import { resetOtpProviderForTests } from './providers/index.js';

export const OTP_SETTINGS_KEY = 'otp.settings';

const otpSettingsSchema = z.object({
  provider: z.enum(['msg91', 'mock']),
  otpLength: z.number().int().min(4).max(8),
  expirySeconds: z.number().int().min(60),
  maxAttempts: z.number().int().min(1).max(10),
  resendCooldownSeconds: z.number().int().min(10),
  testOtp: z.string().regex(/^\d{4,8}$/).optional(),
  msg91: z
    .object({
      authKey: z.string().optional(),
      templateId: z.string().optional(),
      senderId: z.string().optional(),
    })
    .optional(),
});

export type OtpSettingsValue = z.infer<typeof otpSettingsSchema>;

export type ResolvedOtpSettings = {
  provider: 'msg91' | 'mock';
  isMockMode: boolean;
  otpLength: number;
  expirySeconds: number;
  maxAttempts: number;
  resendCooldownSeconds: number;
  testOtp: string;
  msg91AuthKey?: string;
  msg91TemplateId?: string;
  msg91SenderId?: string;
};

const REDACTED = '••••••••';

let cached: { at: number; value: ResolvedOtpSettings } | null = null;
const CACHE_MS = 15_000;

function defaultsFromEnv(): OtpSettingsValue {
  return {
    provider: env.OTP_PROVIDER,
    otpLength: env.OTP_LENGTH,
    expirySeconds: env.OTP_EXPIRY_SECONDS,
    maxAttempts: env.OTP_MAX_ATTEMPTS,
    resendCooldownSeconds: env.OTP_RESEND_COOLDOWN_SECONDS,
    testOtp: env.TEST_OTP,
    msg91: {
      authKey: env.MSG91_AUTH_KEY,
      templateId: env.MSG91_TEMPLATE_ID,
      senderId: env.MSG91_SENDER_ID,
    },
  };
}

function mergeDbWithEnv(db: Partial<OtpSettingsValue>): ResolvedOtpSettings {
  const base = defaultsFromEnv();
  const merged: OtpSettingsValue = {
    provider: db.provider ?? base.provider,
    otpLength: db.otpLength ?? base.otpLength,
    expirySeconds: db.expirySeconds ?? base.expirySeconds,
    maxAttempts: db.maxAttempts ?? base.maxAttempts,
    resendCooldownSeconds: db.resendCooldownSeconds ?? base.resendCooldownSeconds,
    testOtp: db.testOtp ?? base.testOtp,
    msg91: {
      authKey: db.msg91?.authKey || base.msg91?.authKey,
      templateId: db.msg91?.templateId || base.msg91?.templateId,
      senderId: db.msg91?.senderId || base.msg91?.senderId,
    },
  };

  let provider = merged.provider;
  if (env.NODE_ENV === 'production' && provider === 'mock') {
    provider = 'msg91';
  }

  const isMockMode = provider === 'mock' && env.NODE_ENV !== 'production';

  return {
    provider,
    isMockMode,
    otpLength: merged.otpLength,
    expirySeconds: merged.expirySeconds,
    maxAttempts: merged.maxAttempts,
    resendCooldownSeconds: merged.resendCooldownSeconds,
    testOtp: merged.testOtp ?? '1234',
    msg91AuthKey: merged.msg91?.authKey?.trim() || undefined,
    msg91TemplateId: merged.msg91?.templateId?.trim() || undefined,
    msg91SenderId: merged.msg91?.senderId?.trim() || undefined,
  };
}

export async function getResolvedOtpSettings(): Promise<ResolvedOtpSettings> {
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return cached.value;
  }

  let dbValue: Partial<OtpSettingsValue> = {};
  if (mongoose.connection.readyState === 1) {
    try {
      dbValue = await getConfigValue<Partial<OtpSettingsValue>>(OTP_SETTINGS_KEY, {});
    } catch {
      const doc = await ConfigurationModel.findOne({ key: OTP_SETTINGS_KEY }).lean();
      dbValue = (doc?.value ?? {}) as Partial<OtpSettingsValue>;
    }
  }

  const resolved = mergeDbWithEnv(dbValue);
  cached = { at: Date.now(), value: resolved };
  return resolved;
}

export function invalidateOtpSettingsCache(): void {
  cached = null;
  resetOtpProviderForTests();
}

export function validateOtpSettingsInput(value: unknown): OtpSettingsValue {
  const parsed = otpSettingsSchema.safeParse(value);
  if (!parsed.success) {
    throw new BusinessRuleError('Invalid OTP settings');
  }
  if (env.NODE_ENV === 'production' && parsed.data.provider === 'mock') {
    throw new BusinessRuleError('Mock OTP provider is not allowed in production');
  }
  if (parsed.data.provider === 'msg91' && env.NODE_ENV === 'production') {
    if (!parsed.data.msg91?.authKey?.trim() || !parsed.data.msg91?.templateId?.trim()) {
      throw new BusinessRuleError('MSG91 auth key and template ID are required for production OTP');
    }
  }
  return parsed.data;
}

export function mergeOtpSettingsPatch(
  existing: unknown,
  patch: unknown,
): OtpSettingsValue {
  const current = (existing && typeof existing === 'object' ? existing : {}) as OtpSettingsValue;
  const next = (patch && typeof patch === 'object' ? patch : {}) as OtpSettingsValue;

  const msg91 = {
    authKey:
      next.msg91?.authKey && next.msg91.authKey !== REDACTED
        ? next.msg91.authKey
        : current.msg91?.authKey,
    templateId: next.msg91?.templateId ?? current.msg91?.templateId,
    senderId: next.msg91?.senderId ?? current.msg91?.senderId,
  };

  const testOtp =
    next.testOtp && next.testOtp !== REDACTED ? next.testOtp : current.testOtp ?? env.TEST_OTP;

  return validateOtpSettingsInput({
    provider: next.provider ?? current.provider ?? env.OTP_PROVIDER,
    otpLength: next.otpLength ?? current.otpLength ?? env.OTP_LENGTH,
    expirySeconds: next.expirySeconds ?? current.expirySeconds ?? env.OTP_EXPIRY_SECONDS,
    maxAttempts: next.maxAttempts ?? current.maxAttempts ?? env.OTP_MAX_ATTEMPTS,
    resendCooldownSeconds:
      next.resendCooldownSeconds ?? current.resendCooldownSeconds ?? env.OTP_RESEND_COOLDOWN_SECONDS,
    testOtp,
    msg91,
  });
}

export function redactOtpSettingsForAdmin(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const v = { ...(value as OtpSettingsValue) };
  if (v.testOtp) v.testOtp = REDACTED;
  if (v.msg91?.authKey) {
    v.msg91 = { ...v.msg91, authKey: REDACTED };
  }
  return v;
}

export function isTestOtpForSettings(settings: ResolvedOtpSettings, otp: string): boolean {
  return settings.isMockMode && otp === settings.testOtp;
}
