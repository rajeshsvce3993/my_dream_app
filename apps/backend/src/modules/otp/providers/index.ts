import type { ResolvedOtpSettings } from '../otp.settings.service.js';
import type { OtpProvider } from './otpProvider.js';
import { MockOtpProvider } from './mockOtpProvider.js';
import { Msg91OtpProvider } from './msg91OtpProvider.js';

const mock = new MockOtpProvider();
const msg91 = new Msg91OtpProvider();

export function getOtpProviderForSettings(settings: ResolvedOtpSettings): OtpProvider {
  return settings.isMockMode ? mock : msg91;
}

/** Test helper */
export function resetOtpProviderForTests(): void {
  // stateless providers — settings cache cleared separately
}
