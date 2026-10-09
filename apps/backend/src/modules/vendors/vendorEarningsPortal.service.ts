import mongoose from 'mongoose';
import { roundToPaisa } from '../../common/money.util.js';
import { VendorOrderModel } from '../orders/vendorOrder.model.js';
import { taxAwareVendorTotals } from './vendorOrderPortal.service.js';

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeek(d = new Date()) {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = day === 0 ? 6 : day - 1;
  x.setDate(x.getDate() - diff);
  return x;
}

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

async function sumEarnings(vendorId: string, since?: Date) {
  const match: Record<string, unknown> = {
    vendorId: new mongoose.Types.ObjectId(vendorId),
    status: 'DELIVERED',
  };
  if (since) match.updatedAt = { $gte: since };

  const orders = await VendorOrderModel.find(match).select('parentOrderId items').lean();
  const totals = await taxAwareVendorTotals(vendorId, orders);
  return {
    gross: roundToPaisa(totals.sales),
    commission: roundToPaisa(totals.serviceCharge),
    net: roundToPaisa(totals.earnings),
    orders: orders.length,
  };
}

export async function getVendorEarnings(vendorId: string) {
  const [today, week, month, total] = await Promise.all([
    sumEarnings(vendorId, startOfDay()),
    sumEarnings(vendorId, startOfWeek()),
    sumEarnings(vendorId, startOfMonth()),
    sumEarnings(vendorId),
  ]);

  return {
    today: { gross: today.gross, commission: today.commission, net: today.net, orders: today.orders },
    thisWeek: { gross: week.gross, commission: week.commission, net: week.net, orders: week.orders },
    thisMonth: { gross: month.gross, commission: month.commission, net: month.net, orders: month.orders },
    total: { gross: total.gross, commission: total.commission, net: total.net, orders: total.orders },
  };
}
