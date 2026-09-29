import { BusinessRuleError } from '../../../common/errors/AppError.js';
import { logger } from '../../../infrastructure/logging/logger.js';
import type { ResolvedOtpSettings } from '../otp.settings.service.js';
import type { OtpProvider } from './otpProvider.js';

export class Msg91OtpProvider implements OtpProvider {
  async sendOtp(phone: string, otp: string, settings: ResolvedOtpSettings): Promise<void> {
    const authKey = settings.msg91AuthKey;
    const templateId = settings.msg91TemplateId;
    if (!authKey || !templateId) {
      throw new BusinessRuleError('SMS OTP is not configured');
    }

    const mobile = phone.replace(/\D/g, '').replace(/^91/, '91');
    const mobileParam = mobile.startsWith('91') ? mobile : `91${mobile.replace(/^91/, '')}`;

    const url = new URL('https://control.msg91.com/api/v5/otp');
    url.searchParams.set('authkey', authKey);
    url.searchParams.set('template_id', templateId);
    url.searchParams.set('mobile', mobileParam);
    url.searchParams.set('otp', otp);
    if (settings.msg91SenderId) {
      url.searchParams.set('sender', settings.msg91SenderId);
    }
    url.searchParams.set('otp_expiry', String(Math.ceil(settings.expirySeconds / 60)));

    const response = await fetch(url.toString(), { method: 'POST' });
    if (!response.ok) {
      logger.warn({ status: response.status, phone }, 'MSG91 OTP send failed');
      throw new BusinessRuleError('Could not send OTP. Try again later.');
    }

    let body: { type?: string; message?: string } | null = null;
    try {
      body = (await response.json()) as { type?: string; message?: string };
    } catch {
      body = null;
    }
    if (body?.type === 'error') {
      logger.warn({ phone, message: body.message }, 'MSG91 OTP send rejected');
      throw new BusinessRuleError('Could not send OTP. Try again later.');
    }
  }
}
