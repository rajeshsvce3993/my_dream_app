import mongoose from 'mongoose';
import { ValidationError } from '../../common/errors/AppError.js';
import { roundToPaisa, vendorEarningsFromItemTotal } from '../../common/money.util.js';
import { quoteDeliveryEarning } from '../delivery/deliveryPartnerEarnings.service.js';
import { OrderModel } from '../orders/order.model.js';
import { UserModel } from '../users/user.model.js';
import { VendorOrderModel } from '../orders/vendorOrder.model.js';
import { VendorModel } from '../vendors/vendor.model.js';

export type FinancePeriod = 'today' | 'week' | 'month' | 'all';

function periodStart(period: FinancePeriod, now = new Date()): Date | null {
  if (period === 'all') return null;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (period === 'week') {
    const day = start.getDay();
    start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
  } else if (period === 'month') {
    start.setDate(1);
  }
  return start;
}

function lineBeforeTax(line: { lineTotal: number; taxAmount?: number }, fallbackTax = 0) {
  const tax = line.taxAmount ?? fallbackTax;
  return { net: roundToPaisa(Math.max(0, line.lineTotal - tax)), tax: roundToPaisa(Math.max(0, tax)) };
}

export async function getFinanceReport(period: FinancePeriod) {
  const from = periodStart(period);
  const parents = await OrderModel.find({
    status: 'DELIVERED',
    ...(from ? { deliveredAt: { $gte: from } } : {}),
  })
    .select(
      'orderNumber deliveredAt status taxTotal shippingTotal platformFee deliveryEarning deliveryPersonUserId partnerPayoutPaidAt grandTotal items.variantId items.taxAmount',
    )
    .lean();

  const parentIds = parents.map((order) => order._id);
  const vendorOrders = parentIds.length
    ? await VendorOrderModel.find({ parentOrderId: { $in: parentIds } })
        .select('vendorId parentOrderId items vendorPayoutPaidAt')
        .lean()
    : [];
  const vendorIds = [...new Set(vendorOrders.map((order) => order.vendorId.toString()))];
  const vendors = vendorIds.length
    ? await VendorModel.find({ _id: { $in: vendorIds } }).select('name commissionRate').lean()
    : [];
  const vendorById = new Map(vendors.map((vendor) => [vendor._id.toString(), vendor]));

  const taxByParent = new Map<string, Map<string, number>>();
  for (const parent of parents) {
    const lines = new Map<string, number>();
    for (const item of parent.items) lines.set(item.variantId.toString(), item.taxAmount ?? 0);
    taxByParent.set(parent._id.toString(), lines);
  }

  type VendorRow = {
    vendorId: string;
    name: string;
    orders: number;
    sales: number;
    gst: number;
    serviceCharge: number;
    deliveryIncome: number;
    vendorEarnings: number;
    paid: number;
    due: number;
  };
  const byVendor = new Map<string, VendorRow>();
  const sliceSales: {
    parentId: string;
    vendorId: string;
    name: string;
    sales: number;
    gst: number;
    serviceCharge: number;
    restaurantPay: number;
    deliveryIncome: number;
  }[] = [];

  for (const slice of vendorOrders) {
    const id = slice.vendorId.toString();
    const vendor = vendorById.get(id);
    const row = byVendor.get(id) ?? {
      vendorId: id,
      name: vendor?.name ?? 'Restaurant',
      orders: 0,
      sales: 0,
      gst: 0,
      serviceCharge: 0,
      deliveryIncome: 0,
      vendorEarnings: 0,
      paid: 0,
      due: 0,
    };
    const taxes = taxByParent.get(slice.parentOrderId.toString());
    let sales = 0;
    let gst = 0;
    for (const line of slice.items) {
      const split = lineBeforeTax(line, taxes?.get(line.variantId.toString()) ?? 0);
      sales += split.net;
      gst += split.tax;
    }
    const money = vendorEarningsFromItemTotal(sales, vendor?.commissionRate ?? 0);
    sliceSales.push({
      parentId: slice.parentOrderId.toString(),
      vendorId: id,
      name: vendor?.name ?? 'Restaurant',
      sales: money.sales,
      gst: roundToPaisa(gst),
      serviceCharge: money.serviceCharge,
      restaurantPay: money.earnings,
      deliveryIncome: 0,
    });
    row.orders += 1;
    row.sales = roundToPaisa(row.sales + money.sales);
    row.gst = roundToPaisa(row.gst + gst);
    row.serviceCharge = roundToPaisa(row.serviceCharge + money.serviceCharge);
    row.vendorEarnings = roundToPaisa(row.vendorEarnings + money.earnings);
    if (slice.vendorPayoutPaidAt) row.paid = roundToPaisa(row.paid + money.earnings);
    else row.due = roundToPaisa(row.due + money.earnings);
    byVendor.set(id, row);
  }

  const quoted = await Promise.all(parents.map((order) => quoteDeliveryEarning(order)));
  const marginByParent = new Map<string, number>();
  parents.forEach((order, index) => {
    const charged = (order.shippingTotal ?? 0) + (order.platformFee ?? 0);
    marginByParent.set(order._id.toString(), roundToPaisa(charged - (quoted[index] ?? 0)));
  });
  const slicesByParent = new Map<string, (typeof sliceSales)[number][]>();
  for (const slice of sliceSales) {
    const list = slicesByParent.get(slice.parentId) ?? [];
    list.push(slice);
    slicesByParent.set(slice.parentId, list);
  }
  for (const [parentId, slices] of slicesByParent) {
    const margin = marginByParent.get(parentId) ?? 0;
    const salesSum = slices.reduce((sum, slice) => sum + slice.sales, 0);
    let assigned = 0;
    slices.forEach((slice, index) => {
      const share =
        index === slices.length - 1
          ? roundToPaisa(margin - assigned)
          : salesSum > 0
            ? roundToPaisa((margin * slice.sales) / salesSum)
            : roundToPaisa(margin / slices.length);
      assigned = roundToPaisa(assigned + share);
      slice.deliveryIncome = roundToPaisa(slice.deliveryIncome + share);
      const row = byVendor.get(slice.vendorId);
      if (row) row.deliveryIncome = roundToPaisa(row.deliveryIncome + share);
    });
  }
  const partnerIds = [
    ...new Set(parents.map((order) => order.deliveryPersonUserId?.toString()).filter((id): id is string => Boolean(id))),
  ];
  const riders = partnerIds.length
    ? await UserModel.find({ _id: { $in: partnerIds } }).select('firstName lastName phone').lean()
    : [];
  const riderById = new Map(riders.map((rider) => [rider._id.toString(), rider]));
  type PartnerRow = {
    partnerId: string;
    name: string;
    phone: string | null;
    orders: number;
    pay: number;
    paid: number;
    due: number;
  };
  const byPartner = new Map<string, PartnerRow>();
  parents.forEach((order, index) => {
    const id = order.deliveryPersonUserId?.toString() ?? 'unassigned';
    const rider = id === 'unassigned' ? null : riderById.get(id);
    const name = rider ? [rider.firstName, rider.lastName].filter(Boolean).join(' ') : 'Not assigned';
    const row = byPartner.get(id) ?? {
      partnerId: id,
      name: name || 'Delivery partner',
      phone: rider?.phone ?? null,
      orders: 0,
      pay: 0,
      paid: 0,
      due: 0,
    };
    row.orders += 1;
    const amount = quoted[index] ?? 0;
    row.pay = roundToPaisa(row.pay + amount);
    if (order.partnerPayoutPaidAt) row.paid = roundToPaisa(row.paid + amount);
    else row.due = roundToPaisa(row.due + amount);
    byPartner.set(id, row);
  });
  const partnerEarnings = roundToPaisa([...byPartner.values()].reduce((sum, row) => sum + row.pay, 0));
  const deliveryCharges = roundToPaisa(parents.reduce((sum, order) => sum + (order.shippingTotal ?? 0), 0));
  const platformFee = roundToPaisa(parents.reduce((sum, order) => sum + (order.platformFee ?? 0), 0));
  const gst = roundToPaisa([...byVendor.values()].reduce((sum, row) => sum + row.gst, 0));
  const sales = roundToPaisa([...byVendor.values()].reduce((sum, row) => sum + row.sales, 0));
  const serviceCharge = roundToPaisa([...byVendor.values()].reduce((sum, row) => sum + row.serviceCharge, 0));
  const vendorEarnings = roundToPaisa([...byVendor.values()].reduce((sum, row) => sum + row.vendorEarnings, 0));
  const deliveryMargin = roundToPaisa(deliveryCharges + platformFee - partnerEarnings);
  const platformEarnings = roundToPaisa(serviceCharge + deliveryMargin);

  return {
    period,
    from,
    orders: parents.length,
    sales,
    gst,
    vendorEarnings,
    vendorPaid: roundToPaisa([...byVendor.values()].reduce((sum, row) => sum + row.paid, 0)),
    vendorDue: roundToPaisa([...byVendor.values()].reduce((sum, row) => sum + row.due, 0)),
    serviceCharge,
    deliveryCharges,
    platformFee,
    partnerEarnings,
    partnerPaid: roundToPaisa([...byPartner.values()].reduce((sum, row) => sum + row.paid, 0)),
    partnerDue: roundToPaisa([...byPartner.values()].reduce((sum, row) => sum + row.due, 0)),
    deliveryMargin,
    platformEarnings,
    customerPaid: roundToPaisa(sales + gst + deliveryCharges + platformFee),
    orderLines: parents
      .map((order, index) => {
        const id = order._id.toString();
        const slices = slicesByParent.get(id) ?? [];
        const lineSales = roundToPaisa(slices.reduce((sum, slice) => sum + slice.sales, 0));
        const lineGst = roundToPaisa(slices.reduce((sum, slice) => sum + slice.gst, 0));
        const lineService = roundToPaisa(slices.reduce((sum, slice) => sum + slice.serviceCharge, 0));
        const lineRestaurant = roundToPaisa(slices.reduce((sum, slice) => sum + slice.restaurantPay, 0));
        const lineDeliveryIncome = roundToPaisa(slices.reduce((sum, slice) => sum + slice.deliveryIncome, 0));
        const deliveryCharge = roundToPaisa((order.shippingTotal ?? 0) + (order.platformFee ?? 0));
        const partnerPay = roundToPaisa(quoted[index] ?? 0);
        const partnerId = order.deliveryPersonUserId?.toString() ?? 'unassigned';
        const rider = partnerId === 'unassigned' ? null : riderById.get(partnerId);
        const partnerName = rider
          ? [rider.firstName, rider.lastName].filter(Boolean).join(' ') || 'Delivery partner'
          : 'Not assigned';
        return {
          orderId: id,
          orderNumber: order.orderNumber,
          deliveredAt: order.deliveredAt ?? null,
          restaurants: [...new Set(slices.map((slice) => slice.name))].join(', ') || 'Restaurant',
          partnerName,
          totalSale: roundToPaisa(order.grandTotal ?? 0),
          sales: lineSales,
          gst: lineGst,
          serviceCharge: lineService,
          restaurantPay: lineRestaurant,
          deliveryCharge,
          partnerPay,
          deliveryIncome: lineDeliveryIncome,
          income: roundToPaisa(lineService + lineDeliveryIncome),
        };
      })
      .sort((a, b) => {
        const left = a.deliveredAt ? new Date(a.deliveredAt).getTime() : 0;
        const right = b.deliveredAt ? new Date(b.deliveredAt).getTime() : 0;
        return right - left;
      }),
    vendors: [...byVendor.values()]
      .map((row) => ({ ...row, income: roundToPaisa(row.serviceCharge + row.deliveryIncome) }))
      .sort((a, b) => b.income - a.income),
    partners: [...byPartner.values()].sort((a, b) => b.pay - a.pay),
  };
}

export async function setFinancePayout(input: {
  period: FinancePeriod;
  kind: 'vendor' | 'partner';
  partyId: string;
  paid: boolean;
}) {
  if (input.kind !== 'vendor' && input.kind !== 'partner') {
    throw new ValidationError('Choose a restaurant or a delivery partner');
  }
  if (input.kind === 'vendor' && !mongoose.isValidObjectId(input.partyId)) {
    throw new ValidationError('Choose a restaurant');
  }
  if (input.kind === 'partner' && input.partyId !== 'unassigned' && !mongoose.isValidObjectId(input.partyId)) {
    throw new ValidationError('Choose a delivery partner');
  }

  const from = periodStart(input.period);
  const parents = await OrderModel.find({
    status: 'DELIVERED',
    ...(from ? { deliveredAt: { $gte: from } } : {}),
  })
    .select('_id deliveryPersonUserId')
    .lean();

  const stamp = input.paid ? { $set: { partnerPayoutPaidAt: new Date() } } : { $unset: { partnerPayoutPaidAt: 1 } };
  if (input.kind === 'partner') {
    const ids = parents
      .filter((order) => (order.deliveryPersonUserId?.toString() ?? 'unassigned') === input.partyId)
      .map((order) => order._id);
    if (ids.length) await OrderModel.updateMany({ _id: { $in: ids } }, stamp);
  } else {
    const parentIds = parents.map((order) => order._id);
    const vendorStamp = input.paid
      ? { $set: { vendorPayoutPaidAt: new Date() } }
      : { $unset: { vendorPayoutPaidAt: 1 } };
    if (parentIds.length) {
      await VendorOrderModel.updateMany({ parentOrderId: { $in: parentIds }, vendorId: input.partyId }, vendorStamp);
    }
  }

  return getFinanceReport(input.period);
}
