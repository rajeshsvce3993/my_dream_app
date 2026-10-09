import mongoose from 'mongoose';
import { BusinessRuleError, NotFoundError } from '../../common/errors/AppError.js';
import { roundToPaisa, vendorEarningsFromItemTotal } from '../../common/money.util.js';
import { OrderModel } from '../orders/order.model.js';
import { VendorOrderModel } from '../orders/vendorOrder.model.js';
import { VendorModel } from './vendor.model.js';
import { ProductModel } from '../products/product.model.js';
import { ProductVariantModel } from '../products/productVariant.model.js';
import {
  assertValidTransition,
  type OrderStatus,
} from '../orders/orderStateMachine.js';

const NEW_STATUSES: OrderStatus[] = ['PAID', 'CONFIRMED'];
const ACTIVE_STATUSES: OrderStatus[] = ['PROCESSING', 'PACKED', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'];
const DONE_STATUSES: OrderStatus[] = ['DELIVERED', 'CANCELLED', 'REFUNDED', 'FAILED', 'REFUND_REQUESTED'];

type VendorMoneyLine = {
  variantId: { toString(): string };
  quantity: number;
  lineTotal: number;
  taxAmount?: number;
};

function lineBeforeTax(line: VendorMoneyLine, taxByVariant?: Map<string, number>) {
  const tax = line.taxAmount ?? taxByVariant?.get(line.variantId.toString()) ?? 0;
  return roundToPaisa(Math.max(0, line.lineTotal - tax));
}

async function taxByParent(parentIds: string[]) {
  const parents = parentIds.length
    ? await OrderModel.find({ _id: { $in: parentIds } }).select('items.variantId items.taxAmount').lean()
    : [];
  const byParent = new Map<string, Map<string, number>>();
  for (const parent of parents) {
    const lines = new Map<string, number>();
    for (const item of parent.items) {
      lines.set(item.variantId.toString(), item.taxAmount ?? 0);
    }
    byParent.set(parent._id.toString(), lines);
  }
  return byParent;
}

async function configuredServiceCharge(vendorId: string) {
  const vendor = await VendorModel.findById(vendorId).select('commissionRate').lean();
  return vendor?.commissionRate ?? 0;
}

export async function taxAwareVendorTotals(
  vendorId: string,
  orders: Array<{
    parentOrderId: { toString(): string };
    items: VendorMoneyLine[];
  }>,
) {
  const [taxes, serviceChargePercent] = await Promise.all([
    taxByParent([...new Set(orders.map((order) => order.parentOrderId.toString()))]),
    configuredServiceCharge(vendorId),
  ]);
  return orders.reduce(
    (sum, order) => {
      const money = vendorOrderMoney(order, taxes.get(order.parentOrderId.toString()), serviceChargePercent);
      return {
        sales: sum.sales + money.sales,
        serviceCharge: sum.serviceCharge + money.serviceCharge,
        earnings: sum.earnings + money.earnings,
      };
    },
    { sales: 0, serviceCharge: 0, earnings: 0 },
  );
}

export function vendorOrderMoney(
  order: { items: VendorMoneyLine[] },
  taxByVariant?: Map<string, number>,
  serviceChargePercent = 0,
) {
  const itemTotal = order.items.reduce((sum, line) => sum + lineBeforeTax(line, taxByVariant), 0);
  return vendorEarningsFromItemTotal(itemTotal, serviceChargePercent);
}

export function vendorOrderBucket(status: OrderStatus): 'new' | 'active' | 'completed' {
  if (NEW_STATUSES.includes(status)) return 'new';
  if (ACTIVE_STATUSES.includes(status)) return 'active';
  return 'completed';
}

export async function listVendorOrders(
  vendorId: string,
  filters: {
    bucket?: 'new' | 'active' | 'completed';
    status?: OrderStatus;
    from?: Date;
    to?: Date;
    page?: number;
    limit?: number;
  } = {},
) {
  const filter: Record<string, unknown> = { vendorId };
  if (filters.status) filter.status = filters.status;
  else if (filters.bucket === 'new') filter.status = { $in: NEW_STATUSES };
  else if (filters.bucket === 'active') filter.status = { $in: ACTIVE_STATUSES };
  else if (filters.bucket === 'completed') filter.status = { $in: DONE_STATUSES };
  if (filters.from || filters.to) {
    const createdAt: Record<string, Date> = {};
    if (filters.from) createdAt.$gte = filters.from;
    if (filters.to) createdAt.$lte = filters.to;
    filter.createdAt = createdAt;
  }

  const paged = filters.page != null;
  const limit = paged ? Math.min(Math.max(filters.limit ?? 8, 1), 50) : filters.bucket ? 50 : 200;
  const page = paged ? Math.max(filters.page ?? 1, 1) : 1;
  const [total, orders] = await Promise.all([
    VendorOrderModel.countDocuments(filter),
    VendorOrderModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(paged ? (page - 1) * limit : 0)
      .limit(limit)
      .lean(),
  ]);
  const productIds = [...new Set(orders.flatMap((o) => o.items.map((i) => i.productId.toString())))];
  const products = productIds.length
    ? await ProductModel.find({ _id: { $in: productIds } }).select('name').lean()
    : [];
  const productNames = new Map(products.map((p) => [p._id.toString(), p.name?.en]));
  const parentIds = [...new Set(orders.map((o) => o.parentOrderId.toString()))];
  const parents = parentIds.length
    ? await OrderModel.find({ _id: { $in: parentIds } }).select('orderNumber').lean()
    : [];
  const parentNumbers = new Map(parents.map((p) => [p._id.toString(), p.orderNumber]));
  const [taxes, serviceChargePercent] = await Promise.all([
    taxByParent(parentIds),
    configuredServiceCharge(vendorId),
  ]);

  const items = orders.map((o) => {
    const taxLines = taxes.get(o.parentOrderId.toString());
    const money = vendorOrderMoney(o, taxLines, serviceChargePercent);
    return {
    id: o._id,
    orderNumber: parentNumbers.get(o.parentOrderId.toString()) || o.orderNumber,
    status: o.status,
    subtotal: money.sales,
    vendorPayoutAmount: money.earnings,
    itemCount: o.items.reduce((n, i) => n + i.quantity, 0),
    items: o.items.map((line) => ({
      quantity: line.quantity,
      name: productNames.get(line.productId.toString()) || 'Item',
      lineTotal: lineBeforeTax(line, taxLines),
    })),
    createdAt: o.createdAt,
    bucket: vendorOrderBucket(o.status as OrderStatus),
    allowedNextStatuses: allowedVendorTransitions(o.status as OrderStatus),
  };
  });
  return { items, total, page, limit };
}

export async function getVendorOrderDetail(vendorId: string, vendorOrderId: string) {
  const vo = await VendorOrderModel.findOne({ _id: vendorOrderId, vendorId }).lean();
  if (!vo) throw new NotFoundError('Order not found');

  const parent = await OrderModel.findById(vo.parentOrderId)
    .select('orderNumber status paymentStatus deliveryAddress createdAt currency items.variantId items.taxAmount')
    .lean();
  const taxLines = new Map((parent?.items ?? []).map((item) => [item.variantId.toString(), item.taxAmount ?? 0]));
  const serviceChargePercent = await configuredServiceCharge(vendorId);
  const money = vendorOrderMoney(vo, taxLines, serviceChargePercent);

  const productIds = [...new Set(vo.items.map((i) => i.productId.toString()))];
  const variantIds = [...new Set(vo.items.map((i) => i.variantId.toString()))];
  const [products, variants] = await Promise.all([
    ProductModel.find({ _id: { $in: productIds } }).lean(),
    ProductVariantModel.find({ _id: { $in: variantIds } }).lean(),
  ]);
  const productMap = new Map(products.map((p) => [p._id.toString(), p]));
  const variantMap = new Map(variants.map((v) => [v._id.toString(), v]));

  const items = vo.items.map((line) => {
    const product = productMap.get(line.productId.toString());
    const variant = variantMap.get(line.variantId.toString());
    const lineTotal = lineBeforeTax(line, taxLines);
    return {
      ...line,
      lineTotal,
      unitPrice: line.quantity > 0 ? roundToPaisa(lineTotal / line.quantity) : lineTotal,
      productName: product?.name?.en,
      variantName: variant?.name?.en,
      imageUrl: product?.images?.find((i) => i.isPrimary)?.url ?? product?.images?.[0]?.url,
    };
  });

  return {
    vendorOrder: {
      ...vo,
      subtotal: money.sales,
      commissionAmount: money.serviceCharge,
      vendorPayoutAmount: money.earnings,
    },
    parentOrder: parent
      ? {
          orderNumber: parent.orderNumber,
          status: parent.status,
          paymentStatus: parent.paymentStatus,
          deliveryCity: parent.deliveryAddress?.city,
          deliveryLine1: parent.deliveryAddress?.line1,
          createdAt: parent.createdAt,
          currency: parent.currency,
        }
      : null,
    items,
    allowedNextStatuses: allowedVendorTransitions(vo.status as OrderStatus),
  };
}

/** Vendor-operable transitions (subset of global state machine). */
const vendorTransitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PAID: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['PACKED', 'CANCELLED'],
  PACKED: ['READY_FOR_PICKUP', 'CANCELLED'],
};

export function allowedVendorTransitions(from: OrderStatus): OrderStatus[] {
  return vendorTransitions[from] ?? [];
}

export async function syncParentOrderForVendorAction(
  parentOrderId: mongoose.Types.ObjectId,
  toStatus: OrderStatus,
  userId?: string,
  note?: string,
) {
  const parent = await OrderModel.findById(parentOrderId);
  if (!parent) return;
  try {
    assertValidTransition(parent.status as OrderStatus, toStatus);
  } catch {
    return;
  }
  parent.status = toStatus;
  parent.timeline.push({
    status: toStatus,
    at: new Date(),
    by: userId as unknown as mongoose.Types.ObjectId,
    note: note ?? 'Updated from vendor app',
  });
  await parent.save();

  if (toStatus === 'PROCESSING' || toStatus === 'READY_FOR_PICKUP') {
    const { dispatchOrder } = await import('../delivery/deliveryDispatch.service.js');
    void dispatchOrder(parent._id.toString()).catch(() => undefined);
  }
  if (toStatus === 'CANCELLED' || toStatus === 'FAILED' || toStatus === 'REFUNDED') {
    const { releaseAssignmentForTerminalOrder } = await import('../delivery/deliveryAssignment.service.js');
    await releaseAssignmentForTerminalOrder(parent._id.toString());
  }
}

export async function updateVendorOrderStatusForVendor(
  vendorId: string,
  vendorOrderId: string,
  toStatus: OrderStatus,
  userId: string,
  reason?: string,
) {
  const vo = await VendorOrderModel.findOne({ _id: vendorOrderId, vendorId });
  if (!vo) throw new NotFoundError('Order not found');

  const fromStatus = vo.status as OrderStatus;
  const allowed = allowedVendorTransitions(fromStatus);
  if (!allowed.includes(toStatus) && fromStatus !== toStatus) {
    throw new BusinessRuleError(`Cannot move order from ${fromStatus} to ${toStatus}`);
  }
  assertValidTransition(fromStatus, toStatus);

  const trimmedReason = reason?.trim() ?? '';
  if (toStatus === 'CANCELLED' && !trimmedReason) {
    throw new BusinessRuleError('A cancellation reason is required');
  }
  if (trimmedReason.length > 300) {
    throw new BusinessRuleError('Cancellation reason is too long');
  }
  const note = toStatus === 'CANCELLED' ? trimmedReason : 'Vendor update';

  const updated = await VendorOrderModel.findOneAndUpdate(
    { _id: vendorOrderId, vendorId, status: fromStatus },
    {
      $set: { status: toStatus },
      $push: { timeline: { status: toStatus, at: new Date(), note } },
    },
    { new: true },
  );
  if (!updated) {
    throw new BusinessRuleError('Order was updated by another request. Refresh and try again.');
  }

  await syncParentOrderForVendorAction(vo.parentOrderId, toStatus, userId, note);
  return updated;
}

export async function getVendorHomeStats(vendorId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [newCount, activeCount, todayOrders, todayDocs] = await Promise.all([
    VendorOrderModel.countDocuments({ vendorId, status: { $in: NEW_STATUSES } }),
    VendorOrderModel.countDocuments({ vendorId, status: { $in: ACTIVE_STATUSES } }),
    VendorOrderModel.countDocuments({ vendorId, createdAt: { $gte: startOfDay } }),
    VendorOrderModel.find({ vendorId, createdAt: { $gte: startOfDay } })
      .select('parentOrderId items commissionRate')
      .lean(),
  ]);
  const totals = await taxAwareVendorTotals(vendorId, todayDocs);
  return {
    newOrders: newCount,
    activeOrders: activeCount,
    todayOrderCount: todayOrders,
    todaySales: totals.sales ?? 0,
    todayEarnings: totals.earnings ?? 0,
  };
}
