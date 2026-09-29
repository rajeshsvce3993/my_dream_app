import { beforeEach, describe, expect, it } from 'vitest';
import { clearOtpStoreForTests } from '../src/modules/otp/otp.store.js';
import { normalizePhone } from '../src/modules/otp/phone.util.js';
import { getResolvedOtpSettings, invalidateOtpSettingsCache } from '../src/modules/otp/otp.settings.service.js';
import { isTestOtpAllowedForSettings } from '../src/config/otp.config.js';
import { requestOtp, verifyOtp } from '../src/modules/otp/otp.service.js';

describe('phone normalization', () => {
  it('normalizes 10-digit Indian numbers', () => {
    expect(normalizePhone('9876543210')).toBe('+919876543210');
    expect(normalizePhone('+919876543210')).toBe('+919876543210');
    expect(normalizePhone('09876543210')).toBe('+919876543210');
  });
});

describe('OTP provider config', () => {
  it('allows fixed test OTP only in mock non-production mode', async () => {
    invalidateOtpSettingsCache();
    const settings = await getResolvedOtpSettings();
    if (settings.isMockMode) {
      expect(isTestOtpAllowedForSettings(settings, settings.testOtp)).toBe(true);
    } else {
      expect(isTestOtpAllowedForSettings(settings, '1234')).toBe(false);
    }
  });
});

describe('OTP mock flow', () => {
  beforeEach(() => {
    clearOtpStoreForTests();
    invalidateOtpSettingsCache();
  });

  it('request and verify using configured TEST_OTP', async () => {
    const settings = await getResolvedOtpSettings();
    if (!settings.isMockMode) return;

    const phone = '9123456780';
    await requestOtp(phone);
    await expect(verifyOtp(phone, settings.testOtp)).resolves.toBeUndefined();
  });

  it('rejects wrong OTP after request', async () => {
    const settings = await getResolvedOtpSettings();
    if (!settings.isMockMode) return;

    const phone = '9123456781';
    await requestOtp(phone);
    await expect(verifyOtp(phone, '0000')).rejects.toThrow(/Invalid OTP/);
  });
});
