import { BusinessRuleError } from '../../common/errors/AppError.js';

export const ORDER_STATUSES = [
  'PENDING_PAYMENT',
  'PAID',
  'CONFIRMED',
  'PROCESSING',
  'PACKED',
  'READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'REFUND_REQUESTED',
  'REFUNDED',
  'FAILED',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

const transitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ['PAID', 'FAILED', 'CANCELLED'],
  PAID: ['CONFIRMED', 'REFUND_REQUESTED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['PACKED', 'CANCELLED'],
  PACKED: ['READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'],
  READY_FOR_PICKUP: ['DELIVERED', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['REFUND_REQUESTED'],
  CANCELLED: [],
  REFUND_REQUESTED: ['REFUNDED', 'DELIVERED'],
  REFUNDED: [],
  FAILED: [],
};

export function assertValidTransition(from: OrderStatus, to: OrderStatus): void {
  if (from === to) return;
  const allowed = transitions[from] ?? [];
  if (!allowed.includes(to)) {
    throw new BusinessRuleError(`Invalid order status transition from ${from} to ${to}`);
  }
}
