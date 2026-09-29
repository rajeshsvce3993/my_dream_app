import { describe, expect, it } from 'vitest';
import { assertValidTransition } from '../src/modules/orders/orderStateMachine.js';
import { BusinessRuleError } from '../src/common/errors/AppError.js';

describe('order state machine', () => {
  it('allows valid transitions', () => {
    expect(() => assertValidTransition('PENDING_PAYMENT', 'PAID')).not.toThrow();
    expect(() => assertValidTransition('PAID', 'CONFIRMED')).not.toThrow();
  });

  it('rejects invalid transitions', () => {
    expect(() => assertValidTransition('DELIVERED', 'PENDING_PAYMENT')).toThrow(BusinessRuleError);
  });
});
