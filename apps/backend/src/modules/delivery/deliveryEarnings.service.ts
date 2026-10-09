import { OrderModel } from '../orders/order.model.js';
import { PaymentModel } from '../payments/payment.model.js';
import { quoteDeliveryEarning } from './deliveryPartnerEarnings.service.js';

export { quoteDeliveryEarning };

export async function riderPaySummary(order: {
  _id: unknown;
  grandTotal: number;
  shippingTotal: number;
  deliveryEarning?: number | null;
}) {
  const payment = await PaymentModel.findOne({ orderId: order._id }).select('provider').lean();
  const paymentMethod = payment?.provider ?? 'COD';
  return {
    paymentMethod,
    collectAmount: paymentMethod === 'COD' ? order.grandTotal : 0,
    earning: await quoteDeliveryEarning(order),
  };
}

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

  const day = startOfDay(now).getTime();
  const week = startOfWeek(now).getTime();
  const month = startOfMonth(now).getTime();

  let today = 0;
  let todayOrders = 0;
  let thisWeek = 0;
  let weekOrders = 0;
  let thisMonth = 0;
  let monthOrders = 0;
  let total = 0;
  for (const row of delivered) {
    const value = await quoteDeliveryEarning(row);
    total += value;
    const at = row.deliveredAt ? new Date(row.deliveredAt).getTime() : 0;
    if (at >= month) {
      thisMonth += value;
      monthOrders += 1;
    }
    if (at >= week) {
      thisWeek += value;
      weekOrders += 1;
    }
    if (at >= day) {
      today += value;
      todayOrders += 1;
    }
  }

  return {
    currency: delivered[0]?.currency ?? 'INR',
    today,
    todayOrders,
    thisWeek,
    weekOrders,
    thisMonth,
    monthOrders,
    total,
    deliveries: delivered.length,
  };
}

export async function listDeliveryHistory(userId: string, limit = 30) {
  const rows = await OrderModel.find({
    deliveryPersonUserId: userId,
    status: { $in: ['DELIVERED', 'CANCELLED'] },
  })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .select('orderNumber status grandTotal deliveryEarning shippingTotal deliveredAt updatedAt deliveryAddress currency')
    .lean();
  const payments = rows.length
    ? await PaymentModel.find({ orderId: { $in: rows.map((row) => row._id) } })
        .select('orderId provider')
        .lean()
    : [];
  const methodByOrder = new Map(payments.map((payment) => [payment.orderId.toString(), payment.provider]));
  return Promise.all(
    rows.map(async (row) => {
      const paymentMethod = methodByOrder.get(row._id.toString()) ?? 'COD';
      return {
        ...row,
        paymentMethod,
        collectAmount: paymentMethod === 'COD' ? row.grandTotal : 0,
        earning: await quoteDeliveryEarning(row),
      };
    }),
  );
}
