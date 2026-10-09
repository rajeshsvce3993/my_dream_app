import { eventBus } from '../../infrastructure/events/EventBus.js';
import { logger } from '../../infrastructure/logging/logger.js';
import { CustomerModel } from '../customers/customer.model.js';
import { NotificationModel } from './notification.model.js';

export function registerNotificationHandlers(): void {
  eventBus.on('OrderCreated', async (event) => {
    const payload = event.payload as { orderId: string; orderNumber: string };
    const { OrderModel } = await import('../orders/order.model.js');
    const order = await OrderModel.findById(payload.orderId).lean();
    if (!order) return;
    const customer = await CustomerModel.findById(order.customerId).lean();
    if (!customer) return;
    logger.info({ payload, userId: customer.userId }, 'OrderCreated notification');
    await NotificationModel.create({
      userId: customer.userId,
      channel: 'IN_APP',
      event: 'ORDER_PLACED',
      title: { en: 'Order placed', ta: 'ஆர்டர் செய்யப்பட்டது' },
      body: {
        en: `Your order ${payload.orderNumber} has been placed.`,
        ta: `உங்கள் ஆர்டர் ${payload.orderNumber} பதிவு செய்யப்பட்டது.`,
      },
      data: payload,
    }).catch((err) => logger.error({ err }, 'Failed to persist notification'));

    const { VendorOrderModel } = await import('../orders/vendorOrder.model.js');
    const { VendorStaffModel } = await import('../vendors/vendorStaff.model.js');
    const slices = await VendorOrderModel.find({ parentOrderId: order._id }).select('vendorId').lean();
    const staff = await VendorStaffModel.find({
      vendorId: { $in: slices.map((slice) => slice.vendorId) },
      approvalStatus: 'APPROVED',
    })
      .select('userId')
      .lean();
    await Promise.all(
      staff.map((row) =>
        NotificationModel.create({
          userId: row.userId,
          channel: 'IN_APP',
          event: 'ORDER_PLACED',
          title: { en: 'New order' },
          body: { en: `Order ${payload.orderNumber} is waiting for you to accept.` },
          data: payload,
        }).catch((err) => logger.error({ err }, 'Failed to persist vendor order notification')),
      ),
    );
  });
}

export async function listUserNotifications(userId: string, page = 1, limit = 20) {
  const customer = await CustomerModel.findOne({ userId });
  const targetUserId = customer?.userId ?? userId;
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    NotificationModel.find({ userId: targetUserId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    NotificationModel.countDocuments({ userId: targetUserId }),
  ]);
  return { items, total };
}
