import { OrderModel } from '../orders/order.model.js';

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const start = startOfDay(d);
  start.setDate(start.getDate() - diff);
  return start;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export async function getEarnings(userId: string, now = new Date()) {
  const delivered = await OrderModel.find({
    deliveryPersonUserId: userId,
    status: 'DELIVERED',
    deliveredAt: { $ne: null },
  })
    .select('deliveryEarning shippingTotal deliveredAt currency orderNumber')
    .lean();

  const amount = (row: { deliveryEarning?: number; shippingTotal: number }) =>
    row.deliveryEarning ?? row.shippingTotal ?? 0;

  const day = startOfDay(now).getTime();
  const week = startOfWeek(now).getTime();
  const month = startOfMonth(now).getTime();

  let today = 0;
  let thisWeek = 0;
  let thisMonth = 0;
  let total = 0;
  for (const row of delivered) {
    const value = amount(row);
    total += value;
    const at = row.deliveredAt ? new Date(row.deliveredAt).getTime() : 0;
    if (at >= month) thisMonth += value;
    if (at >= week) thisWeek += value;
    if (at >= day) today += value;
  }

  return {
    currency: delivered[0]?.currency ?? 'INR',
    today,
    thisWeek,
    thisMonth,
    total,
    deliveries: delivered.length,
  };
}

export async function listDeliveryHistory(userId: string, limit = 30) {
  return OrderModel.find({
    deliveryPersonUserId: userId,
    status: { $in: ['DELIVERED', 'CANCELLED'] },
  })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .select('orderNumber status grandTotal deliveryEarning shippingTotal deliveredAt deliveryAddress currency')
    .lean();
}
