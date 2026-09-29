import type { ResolvedOtpSettings } from '../otp.settings.service.js';

export interface OtpProvider {
  /** Deliver OTP to the customer (SMS in production). Must not log the OTP. */
  sendOtp(phone: string, otp: string, settings: ResolvedOtpSettings): Promise<void>;
}
