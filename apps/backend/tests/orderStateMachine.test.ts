import { describe, expect, it } from 'vitest';
import { assertValidTransition } from '../src/modules/orders/orderStateMachine.js';
import { BusinessRuleError } from '../src/common/errors/AppError.js';

describe('order state machine', () => {
  it('allows valid transitions', () => {
    expect(() => assertValidTransition('PENDING_PAYMENT', 'PAID')).not.toThrow();
    expect(() => assertValidTransition('PAID', 'CONFIRMED')).not.toThrow();
    expect(() => assertValidTransition('CONFIRMED', 'PROCESSING')).not.toThrow();
    expect(() => assertValidTransition('PROCESSING', 'PACKED')).not.toThrow();
    expect(() => assertValidTransition('PACKED', 'READY_FOR_PICKUP')).not.toThrow();
    expect(() => assertValidTransition('READY_FOR_PICKUP', 'OUT_FOR_DELIVERY')).not.toThrow();
    expect(() => assertValidTransition('OUT_FOR_DELIVERY', 'DELIVERED')).not.toThrow();
  });

  it('does not offer a rider before the restaurant is ready', () => {
    expect(() => assertValidTransition('PACKED', 'OUT_FOR_DELIVERY')).toThrow(BusinessRuleError);
  });

  it('rejects invalid transitions', () => {
    expect(() => assertValidTransition('DELIVERED', 'PENDING_PAYMENT')).toThrow(BusinessRuleError);
  });
});
