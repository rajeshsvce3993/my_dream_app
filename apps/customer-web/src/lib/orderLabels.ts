import { ORDER_STATUS_LABEL } from '../components/OrderTimeline';

export function orderStatusLabel(status: string, locale: 'en' | 'ta') {
  const row = ORDER_STATUS_LABEL[status];
  if (!row) return status.replaceAll('_', ' ');
  return locale === 'ta' && row.ta ? row.ta : row.en;
}
