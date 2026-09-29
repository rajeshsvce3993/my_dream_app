import { BusinessRuleError } from '../../common/errors/AppError.js';
import { SERVICE_AREA_BODY, SERVICE_AREA_TITLE } from './locationAvailability.js';

export const OUTSIDE_SERVICE_AREA_REASON = 'OUTSIDE_SERVICE_AREA';

export class OutsideServiceAreaError extends BusinessRuleError {
  readonly serviceAreaTitle: string;

  constructor(
    body: string = SERVICE_AREA_BODY,
    title: string = SERVICE_AREA_TITLE,
  ) {
    super(body, [{ reason: OUTSIDE_SERVICE_AREA_REASON, title, body }]);
    this.name = 'OutsideServiceAreaError';
    this.serviceAreaTitle = title;
  }
}

export function isOutsideServiceAreaErrorDetail(details: unknown): details is {
  reason: typeof OUTSIDE_SERVICE_AREA_REASON;
  title?: string;
  body?: string;
} {
  return (
    typeof details === 'object' &&
    details !== null &&
    (details as { reason?: string }).reason === OUTSIDE_SERVICE_AREA_REASON
  );
}
