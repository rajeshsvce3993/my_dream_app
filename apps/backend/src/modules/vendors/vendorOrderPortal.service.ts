import mongoose from 'mongoose';
import { BusinessRuleError, NotFoundError } from '../../common/errors/AppError.js';
import { OrderModel } from '../orders/order.model.js';
import { VendorOrderModel } from '../orders/vendorOrder.model.js';
import { ProductModel } from '../products/product.model.js';
import { ProductVariantModel } from '../products/productVariant.model.js';
import {
  assertValidTransition,
  type OrderStatus,
} from '../orders/orderStateMachine.js';

const NEW_STATUSES: OrderStatus[] = ['PAID', 'CONFIRMED'];
const ACTIVE_STATUSES: OrderStatus[] = ['PROCESSING', 'PACKED', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'];
const DONE_STATUSES: OrderStatus[] = ['DELIVERED', 'CANCELLED', 'REFUNDED', 'FAILED', 'REFUND_REQUESTED'];

export function vendorOrderBucket(status: OrderStatus): 'new' | 'active' | 'completed' {
  if (NEW_STATUSES.includes(status)) return 'new';
  if (ACTIVE_STATUSES.includes(status)) return 'active';
  return 'completed';
}

export async function listVendorOrders(vendorId: string, bucket?: 'new' | 'active' | 'completed') {
  const filter: Record<string, unknown> = { vendorId };
  if (bucket === 'new') filter.status = { $in: NEW_STATUSES };
  if (bucket === 'active') filter.status = { $in: ACTIVE_STATUSES };
  if (bucket === 'completed') filter.status = { $in: DONE_STATUSES };

  const orders = await VendorOrderModel.find(filter).sort({ createdAt: -1 }).limit(100).lean();
  return orders.map((o) => ({
    id: o._id,
    orderNumber: o.orderNumber,
    status: o.status,
    subtotal: o.subtotal,
    vendorPayoutAmount: o.vendorPayoutAmount,
    itemCount: o.items.reduce((n, i) => n + i.quantity, 0),
    createdAt: o.createdAt,
    bucket: vendorOrderBucket(o.status as OrderStatus),
  }));
}

export async function getVendorOrderDetail(vendorId: string, vendorOrderId: string) {
  const vo = await VendorOrderModel.findOne({ _id: vendorOrderId, vendorId }).lean();
  if (!vo) throw new NotFoundError('Order not found');

  const parent = await OrderModel.findById(vo.parentOrderId)
    .select('orderNumber status paymentStatus deliveryAddress createdAt currency')
    .lean();

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
    return {
      ...line,
      productName: product?.name?.en,
      variantName: variant?.name?.en,
      imageUrl: product?.images?.find((i) => i.isPrimary)?.url ?? product?.images?.[0]?.url,
    };
  });

  return {
    vendorOrder: vo,
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

async function syncParentOrderForVendorAction(
  parentOrderId: mongoose.Types.ObjectId,
  toStatus: OrderStatus,
  userId: string,
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
    note: 'Updated from vendor app',
  });
  await parent.save();

  if (toStatus === 'PACKED' || toStatus === 'READY_FOR_PICKUP') {
    const { dispatchOrder } = await import('../delivery/deliveryDispatch.service.js');
    void dispatchOrder(parent._id.toString()).catch(() => undefined);
  }
}

export async function updateVendorOrderStatusForVendor(
  vendorId: string,
  vendorOrderId: string,
  toStatus: OrderStatus,
  userId: string,
) {
  const vo = await VendorOrderModel.findOne({ _id: vendorOrderId, vendorId });
  if (!vo) throw new NotFoundError('Order not found');

  const fromStatus = vo.status as OrderStatus;
  const allowed = allowedVendorTransitions(fromStatus);
  if (!allowed.includes(toStatus) && fromStatus !== toStatus) {
    throw new BusinessRuleError(`Cannot move order from ${fromStatus} to ${toStatus}`);
  }
  assertValidTransition(fromStatus, toStatus);

  const updated = await VendorOrderModel.findOneAndUpdate(
    { _id: vendorOrderId, vendorId, status: fromStatus },
    {
      $set: { status: toStatus },
      $push: { timeline: { status: toStatus, at: new Date(), note: 'Vendor update' } },
    },
    { new: true },
  );
  if (!updated) {
    throw new BusinessRuleError('Order was updated by another request. Refresh and try again.');
  }

  await syncParentOrderForVendorAction(vo.parentOrderId, toStatus, userId);
  return updated;
}

export async function getVendorHomeStats(vendorId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [newCount, activeCount, todayOrders, todaySales] = await Promise.all([
    VendorOrderModel.countDocuments({ vendorId, status: { $in: NEW_STATUSES } }),
    VendorOrderModel.countDocuments({ vendorId, status: { $in: ACTIVE_STATUSES } }),
    VendorOrderModel.countDocuments({ vendorId, createdAt: { $gte: startOfDay } }),
    VendorOrderModel.aggregate([
      { $match: { vendorId: new mongoose.Types.ObjectId(vendorId), createdAt: { $gte: startOfDay } } },
      { $group: { _id: null, sales: { $sum: '$subtotal' }, earnings: { $sum: '$vendorPayoutAmount' } } },
    ]),
  ]);

  const totals = todaySales[0] ?? { sales: 0, earnings: 0 };
  return {
    newOrders: newCount,
    activeOrders: activeCount,
    todayOrderCount: todayOrders,
    todaySales: totals.sales ?? 0,
    todayEarnings: totals.earnings ?? 0,
  };
}
