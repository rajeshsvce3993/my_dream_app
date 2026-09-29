import { BusinessRuleError } from '../../common/errors/AppError.js';

/** Normalize Indian mobile numbers to E.164 (+91XXXXXXXXXX). */
export function normalizePhone(input: string): string {
  const trimmed = input.trim().replace(/[\s-]/g, '');
  if (!trimmed) throw new BusinessRuleError('Phone number is required');

  let digits = trimmed;
  if (digits.startsWith('+')) {
    digits = digits.slice(1);
  }
  if (digits.startsWith('91') && digits.length === 12) {
    return `+${digits}`;
  }
  if (/^\d{10}$/.test(digits)) {
    return `+91${digits}`;
  }
  if (digits.startsWith('0') && digits.length === 11) {
    return `+91${digits.slice(1)}`;
  }

  throw new BusinessRuleError('Enter a valid 10-digit mobile number');
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const local = digits.length >= 10 ? digits.slice(-10) : digits;
  if (local.length < 4) return phone;
  const head = local.slice(0, 5);
  const tail = local.slice(-5);
  return `+91 ${head} ${tail}`;
}

export function phoneToLoginEmail(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `p${digits}@phone.dream.local`;
}
