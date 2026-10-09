import mongoose, { Schema } from 'mongoose';
import {
  getDeliveryServiceAreas,
  isPointInsideLaunchArea,
} from '../delivery/deliveryServiceAreas.service.js';

const counterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, required: true },
});

const CounterModel = mongoose.models.Counter || mongoose.model('Counter', counterSchema);

const ORDER_TIME_ZONE = 'Asia/Kolkata';

/** Year, then day, then month, in India time. 1 Oct 2026 → 20260110. */
export function orderDatePart(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: ORDER_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const day = parts.find((part) => part.type === 'day')?.value ?? '00';
  const month = parts.find((part) => part.type === 'month')?.value ?? '00';
  return `${year}${day}${month}`;
}

export function formatOrderSerial(seq: number): string {
  return String(seq).padStart(3, '0');
}

/** ORD + area code, date, daily serial. Example: ORD01-20260110-001 */
export function buildOrderNumber(areaCode: string, date = new Date(), seq = 1): string {
  const code = areaCode.padStart(2, '0');
  return `ORD${code}-${orderDatePart(date)}-${formatOrderSerial(seq)}`;
}

export function orderSerial(orderNumber: string): string {
  const parts = orderNumber.split('-');
  const serial = parts.length >= 3 ? parts[parts.length - 1] : '';
  return serial && /^\d+$/.test(serial) ? serial : orderNumber;
}

async function areaCodeForPoint(lng?: number, lat?: number): Promise<string> {
  if (lng == null || lat == null || !Number.isFinite(lng) || !Number.isFinite(lat)) return '00';
  const areas = await getDeliveryServiceAreas();
  const match = areas.find((area) => isPointInsideLaunchArea(lng, lat, area));
  return match?.code?.padStart(2, '0') || '00';
}

/**
 * Next order number for a drop pin.
 * Each service area keeps its own serial, and that serial restarts at 001 every day.
 */
export async function nextOrderNumber(lng?: number, lat?: number, now = new Date()): Promise<string> {
  const code = await areaCodeForPoint(lng, lat);
  const datePart = orderDatePart(now);
  const key = `order:${code}:${datePart}`;
  await CounterModel.updateOne({ _id: key }, { $setOnInsert: { seq: 0 } }, { upsert: true });
  const doc = await CounterModel.findByIdAndUpdate(key, { $inc: { seq: 1 } }, { new: true }).lean();
  if (!doc || typeof doc.seq !== 'number') {
    throw new Error('Could not allocate an order number');
  }
  return buildOrderNumber(code, now, doc.seq);
}
