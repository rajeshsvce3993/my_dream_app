import { describe, expect, it } from 'vitest';
import { buildOrderNumber, orderDatePart, orderSerial } from '../src/modules/orders/orderNumber.util.js';

describe('order numbers', () => {
  const istNoon = new Date('2026-10-01T06:30:00.000Z');

  it('builds ORD + area + YYYYDDMM + daily serial', () => {
    expect(orderDatePart(istNoon)).toBe('20260110');
    expect(buildOrderNumber('1', istNoon, 1)).toBe('ORD01-20260110-001');
    expect(buildOrderNumber('03', istNoon, 1000)).toBe('ORD03-20260110-1000');
    expect(orderSerial('ORD03-20260110-001')).toBe('001');
  });
});
