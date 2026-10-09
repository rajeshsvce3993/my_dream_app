/** Daily serial from ORD01-20260110-001. Cards show this; the detail screen shows the full id. */
export function orderSerial(orderNumber: string): string {
  const parts = orderNumber.split('-');
  const serial = parts.length >= 3 ? parts[parts.length - 1] : '';
  return serial && /^\d+$/.test(serial) ? serial : orderNumber;
}

export type QueueStatusTone = 'new' | 'active' | 'done' | 'cancel';

export function queueStatusTone(status: string): QueueStatusTone {
  if (status === 'PAID' || status === 'CONFIRMED') return 'new';
  if (status === 'CANCELLED' || status === 'FAILED' || status === 'REFUNDED' || status === 'REFUND_REQUESTED') {
    return 'cancel';
  }
  if (status === 'DELIVERED') return 'done';
  return 'active';
}

export function queueStatusLabel(status: string): string {
  if (status === 'PAID' || status === 'CONFIRMED') return 'New';
  if (status === 'PROCESSING') return 'Preparing';
  if (status === 'PACKED') return 'Packed';
  if (status === 'READY_FOR_PICKUP') return 'Ready';
  if (status === 'OUT_FOR_DELIVERY') return 'On the way';
  if (status === 'DELIVERED') return 'Delivered';
  if (status === 'CANCELLED') return 'Cancelled';
  return status.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function kitchenActionLabel(status: string): string {
  if (status === 'PROCESSING') return 'Accept';
  if (status === 'PACKED') return 'Packed';
  if (status === 'READY_FOR_PICKUP') return 'Ready';
  if (status === 'CANCELLED') return 'Cancel';
  return status.replaceAll('_', ' ');
}
