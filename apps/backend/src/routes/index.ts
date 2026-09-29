import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes.js';
import { cartRouter } from '../modules/cart/cart.routes.js';
import { categoryRouter } from '../modules/categories/category.routes.js';
import { checkoutRouter } from '../modules/checkout/checkout.routes.js';
import { configurationRouter } from '../modules/configuration/configuration.routes.js';
import { notificationRouter } from '../modules/notifications/notification.routes.js';
import { orderRouter } from '../modules/orders/order.routes.js';
import { productRouter, vendorProductRouter } from '../modules/products/product.routes.js';
import { vendorRouter } from '../modules/vendors/vendor.routes.js';
import { vendorPortalRouter } from '../modules/vendors/vendorPortal.routes.js';
import { reportsRouter } from '../modules/reports/reports.routes.js';
import { catalogRouter } from '../modules/catalog/catalog.routes.js';
import { deliveryRouter } from '../modules/delivery/delivery.routes.js';
import { deliveryPersonRouter } from '../modules/delivery/deliveryPerson.routes.js';
import { customerRouter } from '../modules/customers/customer.routes.js';

export function createApiRouter(): Router {
  const router = Router();

  router.use('/auth', authRouter);
  router.use('/customers', customerRouter);
  router.use('/configuration', configurationRouter);
  router.use('/categories', categoryRouter);
  router.use('/vendors', vendorRouter);
  router.use('/vendor', vendorPortalRouter);
  router.use('/products', productRouter);
  router.use('/vendor-products', vendorProductRouter);
  router.use('/cart', cartRouter);
  router.use('/checkout', checkoutRouter);
  router.use('/orders', orderRouter);
  router.use('/notifications', notificationRouter);
  router.use('/reports', reportsRouter);
  router.use('/catalog', catalogRouter);
  router.use('/delivery', deliveryRouter);
  router.use('/delivery', deliveryPersonRouter);

  return router;
}
