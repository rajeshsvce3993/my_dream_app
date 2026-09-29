import { logger } from '../../../infrastructure/logging/logger.js';
import type { ResolvedOtpSettings } from '../otp.settings.service.js';
import type { OtpProvider } from './otpProvider.js';

/** Development/testing only — no SMS is sent. */
export class MockOtpProvider implements OtpProvider {
  async sendOtp(phone: string, _otp: string, _settings: ResolvedOtpSettings): Promise<void> {
    logger.info({ phone }, 'Mock OTP provider: OTP not sent (development mode)');
  }
}
