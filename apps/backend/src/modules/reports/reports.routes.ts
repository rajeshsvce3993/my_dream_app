import { Router } from 'express';
import { successResponse } from '../../common/types/api.js';
import { authenticate, requirePermissions } from '../auth/auth.middleware.js';
import { OrderModel } from '../orders/order.model.js';
import { ProductModel } from '../products/product.model.js';
import { CustomerModel } from '../customers/customer.model.js';
import { VendorModel } from '../vendors/vendor.model.js';
import { InventoryModel } from '../inventory/inventory.model.js';
import { getFinanceReport, setFinancePayout, type FinancePeriod } from './finance.service.js';

export const reportsRouter = Router();

const PERIODS = new Set<FinancePeriod>(['today', 'week', 'month', 'all']);

reportsRouter.get(
  '/finance',
  authenticate,
  requirePermissions('report.read'),
  async (req, res, next) => {
    try {
      const raw = String(req.query.period ?? 'month');
      const period: FinancePeriod = PERIODS.has(raw as FinancePeriod) ? (raw as FinancePeriod) : 'month';
      res.json(successResponse(await getFinanceReport(period)));
    } catch (err) {
      next(err);
    }
  },
);

reportsRouter.post(
  '/finance/payout',
  authenticate,
  requirePermissions('report.read'),
  async (req, res, next) => {
    try {
      const body = (req.body ?? {}) as { period?: string; kind?: string; partyId?: string; paid?: boolean };
      const raw = String(body.period ?? 'month');
      const period: FinancePeriod = PERIODS.has(raw as FinancePeriod) ? (raw as FinancePeriod) : 'month';
      const kind = body.kind === 'partner' ? 'partner' : 'vendor';
      res.json(
        successResponse(
          await setFinancePayout({
            period,
            kind,
            partyId: String(body.partyId ?? ''),
            paid: body.paid !== false,
          }),
        ),
      );
    } catch (err) {
      next(err);
    }
  },
);

reportsRouter.get(
  '/dashboard',
  authenticate,
  requirePermissions('report.read'),
  async (req, res, next) => {
    try {
      const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 30 * 86400000);
      const to = req.query.to ? new Date(String(req.query.to)) : new Date();

      const orderFilter = { createdAt: { $gte: from, $lte: to }, status: { $ne: 'CANCELLED' } };

      const [orderStats, recentOrders, totals] = await Promise.all([
        OrderModel.aggregate([
          { $match: orderFilter },
          {
            $group: {
              _id: null,
              revenue: { $sum: '$grandTotal' },
              orderCount: { $sum: 1 },
            },
          },
        ]),
        OrderModel.find(orderFilter)
          .sort({ createdAt: -1 })
          .limit(10)
          .select('_id orderNumber grandTotal status')
          .lean(),
        Promise.all([
          CustomerModel.countDocuments(),
          VendorModel.countDocuments({ status: 'ACTIVE' }),
          ProductModel.countDocuments({ status: 'ACTIVE' }),
          OrderModel.countDocuments({ status: 'PENDING_PAYMENT' }),
          OrderModel.countDocuments({ status: 'CANCELLED', createdAt: { $gte: from, $lte: to } }),
          InventoryModel.countDocuments({ $expr: { $lte: ['$available', '$lowStockThreshold'] } }),
        ]),
      ]);

      const [customers, vendors, products, pendingOrders, cancelledOrders, lowStock] = totals;

      res.json(
        successResponse({
          period: { from, to },
          revenue: orderStats[0]?.revenue ?? 0,
          orders: orderStats[0]?.orderCount ?? 0,
          customers,
          vendors,
          products,
          pendingOrders,
          cancelledOrders,
          lowStock,
          recentOrders,
        }),
      );
    } catch (err) {
      next(err);
    }
  },
);
