import { Router } from 'express';
import { successResponse } from '../../common/types/api.js';
import { getLocationAvailabilityForCustomer } from './deliveryServiceAreas.service.js';
import { SERVICE_AREA_BODY, SERVICE_AREA_TITLE } from './locationAvailability.js';

export const deliveryRouter = Router();

deliveryRouter.get('/location-status', async (req, res, next) => {
  try {
    const lng = Number(req.query.lng);
    const lat = Number(req.query.lat);
    if (Number.isNaN(lng) || Number.isNaN(lat)) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'lng and lat required' },
      });
      return;
    }
    const info = await getLocationAvailabilityForCustomer(lng, lat);
    res.json(
      successResponse({
        inServiceArea: info.inServiceArea,
        reason: info.reason,
        serviceAreaTitle: info.serviceAreaTitle ?? SERVICE_AREA_TITLE,
        serviceAreaMessage: info.serviceAreaMessage ?? SERVICE_AREA_BODY,
      }),
    );
  } catch (err) {
    next(err);
  }
});
