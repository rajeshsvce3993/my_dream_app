import mongoose from 'mongoose';
import { NotFoundError } from '../../common/errors/AppError.js';
import { CustomerModel } from '../customers/customer.model.js';
import { UserModel } from '../users/user.model.js';
import { ProductModel } from '../products/product.model.js';
import { ProductVariantModel } from '../products/productVariant.model.js';
import { VendorModel } from '../vendors/vendor.model.js';
import { getConfigValue } from '../configuration/configuration.service.js';
import { OrderModel } from './order.model.js';
import { VendorOrderModel } from './vendorOrder.model.js';
import {
  assertValidTransition,
  ORDER_STATUSES,
  type OrderStatus,
} from './orderStateMachine.js';

export { ORDER_STATUSES };

const transitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ['PAID', 'FAILED', 'CANCELLED'],
  PAID: ['CONFIRMED', 'REFUND_REQUESTED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['PACKED', 'CANCELLED'],
  PACKED: ['READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'],
  READY_FOR_PICKUP: ['DELIVERED', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['REFUND_REQUESTED'],
  CANCELLED: [],
  REFUND_REQUESTED: ['REFUNDED', 'DELIVERED'],
  REFUNDED: [],
  FAILED: [],
};

export function allowedNextStatuses(current: OrderStatus): OrderStatus[] {
  return transitions[current] ?? [];
}

export async function getAdminOrderDetail(orderId: string): Promise<Record<string, unknown>> {
  const order = await OrderModel.findById(orderId).lean();
  if (!order) throw new NotFoundError('Order not found');

  const vendorOrders = await VendorOrderModel.find({ parentOrderId: order._id }).lean();
  const vendorDocs = await VendorModel.find({
    _id: { $in: [...new Set(vendorOrders.map((v) => v.vendorId))] },
  }).lean();
  const vendorNameMap = new Map(vendorDocs.map((v) => [v._id.toString(), v.name]));

  const productIds = [...new Set(order.items.map((i) => i.productId.toString()))];
  const variantIds = [...new Set(order.items.map((i) => i.variantId.toString()))];
  const [productDocs, variantDocs] = await Promise.all([
    ProductModel.find({ _id: { $in: productIds } }).lean(),
    ProductVariantModel.find({ _id: { $in: variantIds } }).lean(),
  ]);
  const productMap = new Map(productDocs.map((p) => [p._id.toString(), p]));
  const variantMap = new Map(variantDocs.map((v) => [v._id.toString(), v]));

  const customer = await CustomerModel.findById(order.customerId).lean();
  let customerUser: { email?: string; firstName?: string; lastName?: string; phone?: string } | null =
    null;
  if (customer?.userId) {
    const user = await UserModel.findById(customer.userId).lean();
    if (user) {
      customerUser = {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
      };
    }
  }

  const items = order.items.map((item) => {
    const product = productMap.get(item.productId.toString());
    const variant = variantMap.get(item.variantId.toString());
    return {
      ...item,
      productName: product?.name,
      variantName: variant?.name,
      sku: variant?.sku ?? product?.sku,
      imageUrl: product?.images?.find((i) => i.isPrimary)?.url ?? product?.images?.[0]?.url,
      vendorName: vendorNameMap.get(item.vendorId.toString()),
    };
  });

  const deliveryPartner = await getConfigValue<string>('delivery.partnerName', 'Delhivery');

  return {
    order,
    customer: customerUser,
    vendorOrders: vendorOrders.map((vo) => ({
      ...vo,
      vendorName: vendorNameMap.get(vo.vendorId.toString()),
      items: vo.items.map((line) => {
        const product = productMap.get(line.productId.toString());
        const variant = variantMap.get(line.variantId.toString());
        return {
          ...line,
          productName: product?.name,
          variantName: variant?.name,
          sku: variant?.sku ?? product?.sku,
          imageUrl: product?.images?.find((i) => i.isPrimary)?.url ?? product?.images?.[0]?.url,
        };
      }),
    })),
    items,
    tracking: {
      partner: deliveryPartner,
      trackingId: order.orderNumber,
    },
    allowedNextStatuses: allowedNextStatuses(order.status as OrderStatus),
  };
}

export async function updateParentOrderStatus(
  orderId: string,
  toStatus: OrderStatus,
  userId?: string,
  note?: string,
) {
  const order = await OrderModel.findById(orderId);
  if (!order) throw new NotFoundError('Order not found');
  assertValidTransition(order.status as OrderStatus, toStatus);
  order.status = toStatus;
  order.timeline.push({
    status: toStatus,
    at: new Date(),
    by: userId as unknown as mongoose.Types.ObjectId,
    note,
  });
  await order.save();

  const vendorOrders = await VendorOrderModel.find({ parentOrderId: order._id });
  for (const vo of vendorOrders) {
    try {
      assertValidTransition(vo.status as OrderStatus, toStatus);
      vo.status = toStatus;
      vo.timeline.push({ status: toStatus, at: new Date(), note: note ?? 'Synced from parent order' });
      await vo.save();
    } catch {
      // Vendor slice may be ahead/behind; skip invalid sync
    }
  }

  if (toStatus === 'PACKED' || toStatus === 'READY_FOR_PICKUP') {
    const { dispatchOrder } = await import('../delivery/deliveryDispatch.service.js');
    void dispatchOrder(order._id.toString()).catch(() => undefined);
  }
  if (toStatus === 'CANCELLED' || toStatus === 'FAILED' || toStatus === 'REFUNDED' || toStatus === 'DELIVERED') {
    const { releaseAssignmentForTerminalOrder } = await import('../delivery/deliveryAssignment.service.js');
    await releaseAssignmentForTerminalOrder(order._id.toString());
  }

  return order;
}

export async function updateVendorOrderStatus(
  vendorOrderId: string,
  toStatus: OrderStatus,
  options?: { note?: string; trackingNumber?: string },
) {
  const vo = await VendorOrderModel.findById(vendorOrderId);
  if (!vo) throw new NotFoundError('Vendor order not found');
  assertValidTransition(vo.status as OrderStatus, toStatus);
  vo.status = toStatus;
  vo.timeline.push({ status: toStatus, at: new Date(), note: options?.note });
  if (options?.trackingNumber !== undefined) {
    vo.trackingNumber = options.trackingNumber.trim() || undefined;
  }
  await vo.save();
  return vo;
}
