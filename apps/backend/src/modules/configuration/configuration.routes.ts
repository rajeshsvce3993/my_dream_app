import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../common/middleware/validate.js';
import { successResponse } from '../../common/types/api.js';
import { authenticate, requirePermissions } from '../auth/auth.middleware.js';
import { ConfigurationModel } from './configuration.model.js';
import { getPublicConfiguration, setConfigValue } from './configuration.service.js';
import {
  OTP_SETTINGS_KEY,
  invalidateOtpSettingsCache,
  mergeOtpSettingsPatch,
  redactOtpSettingsForAdmin,
} from '../otp/otp.settings.service.js';
import {
  DELIVERY_SERVICE_AREAS_KEY,
  validateDeliveryServiceAreasConfig,
} from '../delivery/deliveryServiceAreas.service.js';
import { parseHomeVerticals } from '../catalog/homeVerticals.types.js';
import { parseHomeTopPicks } from '../catalog/homeTopPicks.types.js';
import { assertTopPicksSoldInServiceAreas } from '../catalog/topPickAvailability.service.js';
import { FOOD_CHARGES_KEY, parseFoodCharges } from '../pricing/foodCharges.service.js';
import { PARTNER_EARNINGS_KEY, parsePartnerEarnings } from '../delivery/deliveryPartnerEarnings.service.js';

const HOME_VERTICALS_KEY = 'home.verticals';
const HOME_TOP_PICKS_KEY = 'home.topPicks';

export const configurationRouter = Router();

configurationRouter.get('/public', async (_req, res, next) => {
  try {
    const data = await getPublicConfiguration();
    res.json(successResponse(data));
  } catch (err) {
    next(err);
  }
});

configurationRouter.get(
  '/',
  authenticate,
  requirePermissions('configuration.read'),
  async (_req, res, next) => {
    try {
      const items = await ConfigurationModel.find().sort({ category: 1, key: 1 }).lean();
      const safe = items.map((item) =>
        item.key === OTP_SETTINGS_KEY
          ? { ...item, value: redactOtpSettingsForAdmin(item.value) }
          : item,
      );
      res.json(successResponse(safe));
    } catch (err) {
      next(err);
    }
  },
);

configurationRouter.patch(
  '/:key',
  authenticate,
  requirePermissions('configuration.update'),
  validate({
    params: z.object({ key: z.string().min(1) }),
    body: z.object({ value: z.unknown() }),
  }),
  async (req, res, next) => {
    try {
      const key = String(req.params.key);
      let value = req.body.value;
      if (key === OTP_SETTINGS_KEY) {
        const existing = await ConfigurationModel.findOne({ key }).lean();
        value = mergeOtpSettingsPatch(existing?.value, req.body.value);
        invalidateOtpSettingsCache();
        if (!existing) {
          await ConfigurationModel.create({
            key: OTP_SETTINGS_KEY,
            value,
            category: 'auth',
            isPublic: false,
            description: 'Customer OTP login settings (admin-only)',
            updatedBy: req.auth!.sub,
          });
          res.json(successResponse(null, 'Configuration updated'));
          return;
        }
      }
      if (key === HOME_VERTICALS_KEY) {
        value = parseHomeVerticals(req.body.value);
      }
      if (key === HOME_TOP_PICKS_KEY) {
        value = parseHomeTopPicks(req.body.value);
        await assertTopPicksSoldInServiceAreas(value);
      }
      if (key === FOOD_CHARGES_KEY) {
        value = parseFoodCharges(req.body.value);
        const existing = await ConfigurationModel.findOne({ key }).lean();
        if (!existing) {
          await ConfigurationModel.create({
            key: FOOD_CHARGES_KEY,
            value,
            category: 'food',
            isPublic: false,
            description: 'Food delivery (base km + per km), platform fee, and GST. Other verticals are separate.',
            updatedBy: req.auth!.sub,
          });
          res.json(successResponse(null, 'Configuration updated'));
          return;
        }
      }
      if (key === PARTNER_EARNINGS_KEY) {
        value = parsePartnerEarnings(req.body.value);
        const existing = await ConfigurationModel.findOne({ key }).lean();
        if (!existing) {
          await ConfigurationModel.create({
            key: PARTNER_EARNINGS_KEY,
            value,
            category: 'delivery',
            isPublic: false,
            description: 'Delivery partner earning from restaurant to customer: base km, base charge, and per km.',
            updatedBy: req.auth!.sub,
          });
        }
      }
      if (key === DELIVERY_SERVICE_AREAS_KEY) {
        value = validateDeliveryServiceAreasConfig(req.body.value);
        const existing = await ConfigurationModel.findOne({ key }).lean();
        if (!existing) {
          await ConfigurationModel.create({
            key: DELIVERY_SERVICE_AREAS_KEY,
            value,
            category: 'delivery',
            isPublic: false,
            description: 'Platform service areas (lat/lng + radius). Customer must be inside one zone.',
            updatedBy: req.auth!.sub,
          });
          res.json(successResponse(null, 'Configuration updated'));
          return;
        }
      }
      await setConfigValue(key, value, req.auth!.sub);
      res.json(successResponse(null, 'Configuration updated'));
    } catch (err) {
      next(err);
    }
  },
);
