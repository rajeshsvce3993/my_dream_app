import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../common/middleware/validate.js';
import { paginatedMeta, successResponse } from '../../common/types/api.js';
import { NotFoundError } from '../../common/errors/AppError.js';
import { authenticate, requirePermissions } from '../auth/auth.middleware.js';
import { CustomerModel } from '../customers/customer.model.js';
import { OrderModel } from './order.model.js';
import { VendorOrderModel } from './vendorOrder.model.js';
import { ProductModel } from '../products/product.model.js';
import { UserModel } from '../users/user.model.js';
import { VendorModel } from '../vendors/vendor.model.js';
import { getConfigValue } from '../configuration/configuration.service.js';
import { updateOrderStatus } from '../checkout/checkout.service.js';
import { ORDER_STATUSES } from './orderStateMachine.js';
import {
  getAdminOrderDetail,
  updateVendorOrderStatus,
} from './order.admin.service.js';

export const orderRouter = Router();

orderRouter.get('/my', authenticate, async (req, res, next) => {
  try {
    const customer = await CustomerModel.findOne({ userId: req.auth!.sub });
    if (!customer) {
      res.json(successResponse([]));
      return;
    }
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const [orders, total] = await Promise.all([
      OrderModel.find({ customerId: customer._id })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      OrderModel.countDocuments({ customerId: customer._id }),
    ]);

    const vendorIds = [...new Set(orders.flatMap((o) => o.items.map((i) => i.vendorId.toString())))];
    const productIds = [...new Set(orders.flatMap((o) => o.items.map((i) => i.productId.toString())))];
    const [vendorDocs, productDocs] = await Promise.all([
      VendorModel.find({ _id: { $in: vendorIds } }).select('name').lean(),
      ProductModel.find({ _id: { $in: productIds } })
        .select('name images')
        .lean(),
    ]);
    const vendorNameMap = new Map(vendorDocs.map((v) => [v._id.toString(), v.name]));
    const productMap = new Map(productDocs.map((p) => [p._id.toString(), p]));

    const summaries = orders.map((order) => {
      const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);
      const vendorNames = [
        ...new Set(
          order.items
            .map((i) => vendorNameMap.get(i.vendorId.toString()))
            .filter((n): n is string => Boolean(n)),
        ),
      ];
      const itemNames = order.items.map((i) => {
        const product = productMap.get(i.productId.toString());
        return product?.name?.en ?? 'Item';
      });
      const firstProduct = productMap.get(order.items[0]?.productId?.toString() ?? '');
      const previewImageUrl =
        firstProduct?.images?.find((img) => img.isPrimary)?.url ?? firstProduct?.images?.[0]?.url;

      return {
        _id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        grandTotal: order.grandTotal,
        createdAt: order.createdAt,
        itemCount,
        restaurantName: vendorNames[0] ?? 'Restaurant',
        restaurantNames: vendorNames,
        itemPreview: itemNames.slice(0, 2).join(', '),
        moreItemCount: Math.max(0, itemNames.length - 2),
        previewImageUrl,
      };
    });

    res.json(successResponse(summaries, null, paginatedMeta(page, limit, total) as unknown as Record<string, unknown>));
  } catch (err) {
    next(err);
  }
});

orderRouter.get('/my/:id', authenticate, async (req, res, next) => {
  try {
    const customer = await CustomerModel.findOne({ userId: req.auth!.sub });
    if (!customer) throw new NotFoundError('Order not found');
    const order = await OrderModel.findOne({ _id: req.params.id, customerId: customer._id }).lean();
    if (!order) throw new NotFoundError('Order not found');
    const vendorOrders = await VendorOrderModel.find({ parentOrderId: order._id }).lean();
    const vendorDocs = await VendorModel.find({
      _id: { $in: [...new Set(vendorOrders.map((v) => v.vendorId))] },
    }).lean();
    const vendorNameMap = new Map(vendorDocs.map((v) => [v._id.toString(), v.name]));
    const productDocs = await ProductModel.find({
      _id: { $in: [...new Set(order.items.map((i) => i.productId))] },
    }).lean();
    const productMap = new Map(productDocs.map((p) => [p._id.toString(), p]));
    const items = order.items.map((item) => {
      const product = productMap.get(item.productId.toString());
      return {
        ...item,
        productName: product?.name,
        imageUrl: product?.images?.find((i) => i.isPrimary)?.url ?? product?.images?.[0]?.url,
        vendorName: vendorNameMap.get(item.vendorId.toString()),
      };
    });
    const deliveryPartner = await getConfigValue<string>('delivery.partnerName', 'Delhivery');
    const assignedUser = order.deliveryPersonUserId
      ? await UserModel.findById(order.deliveryPersonUserId).select('firstName lastName phone').lean()
      : null;
    res.json(
      successResponse({
        order,
        vendorOrders: vendorOrders.map((vo) => ({
          ...vo,
          vendorName: vendorNameMap.get(vo.vendorId.toString()),
        })),
        items,
        tracking: {
          partner: deliveryPartner,
          trackingId: order.orderNumber,
          assignedPartner: assignedUser
            ? {
                name: [assignedUser.firstName, assignedUser.lastName].filter(Boolean).join(' '),
                phone: assignedUser.phone,
              }
            : null,
        },
      }),
    );
  } catch (err) {
    next(err);
  }
});

orderRouter.get(
  '/',
  authenticate,
  requirePermissions('order.read'),
  async (req, res, next) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
      const filter: Record<string, unknown> = {};
      if (req.query.status) filter.status = req.query.status;
      const [orders, total] = await Promise.all([
        OrderModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        OrderModel.countDocuments(filter),
      ]);
      const vendorIds = [...new Set(orders.flatMap((order) => order.items.map((item) => item.vendorId.toString())))];
      const vendorDocs = await VendorModel.find({ _id: { $in: vendorIds } }).select('name').lean();
      const vendorNameMap = new Map(vendorDocs.map((vendor) => [vendor._id.toString(), vendor.name]));
      const rows = orders.map((order) => {
        const restaurantNames = [
          ...new Set(
            order.items
              .map((item) => vendorNameMap.get(item.vendorId.toString()))
              .filter((name): name is string => Boolean(name)),
          ),
        ];
        return {
          ...order,
          restaurantName: restaurantNames[0] ?? '',
          restaurantNames,
        };
      });
      res.json(successResponse(rows, null, paginatedMeta(page, limit, total) as unknown as Record<string, unknown>));
    } catch (err) {
      next(err);
    }
  },
);

orderRouter.patch(
  '/vendor-orders/:vendorOrderId/status',
  authenticate,
  requirePermissions('order.update'),
  validate({
    params: z.object({ vendorOrderId: z.string().min(1) }),
    body: z.object({
      status: z.enum(ORDER_STATUSES),
      note: z.string().max(500).optional(),
      trackingNumber: z.string().max(120).optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const vo = await updateVendorOrderStatus(String(req.params.vendorOrderId), req.body.status, {
        note: req.body.note,
        trackingNumber: req.body.trackingNumber,
      });
      res.json(successResponse(vo));
    } catch (err) {
      next(err);
    }
  },
);

orderRouter.get(
  '/:id',
  authenticate,
  requirePermissions('order.read'),
  async (req, res, next) => {
    try {
      const detail = await getAdminOrderDetail(String(req.params.id));
      res.json(successResponse(detail));
    } catch (err) {
      next(err);
    }
  },
);

orderRouter.patch(
  '/:id/status',
  authenticate,
  requirePermissions('order.update'),
  validate({
    params: z.object({ id: z.string().min(1) }),
    body: z.object({ status: z.enum(ORDER_STATUSES), note: z.string().optional() }),
  }),
  async (req, res, next) => {
    try {
      const order = await updateOrderStatus(
        String(req.params.id),
        req.body.status,
        req.auth!.sub,
        req.body.note,
      );
      res.json(successResponse(order));
    } catch (err) {
      next(err);
    }
  },
);
