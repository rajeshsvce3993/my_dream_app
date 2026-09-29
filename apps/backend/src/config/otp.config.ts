import type { ResolvedOtpSettings } from '../modules/otp/otp.settings.service.js';

/** @deprecated use getResolvedOtpSettings().isMockMode */
export function isMockOtpProviderFromSettings(settings: ResolvedOtpSettings): boolean {
  return settings.isMockMode;
}

export function isTestOtpAllowedForSettings(settings: ResolvedOtpSettings, otp: string): boolean {
  return settings.isMockMode && otp === settings.testOtp;
}
