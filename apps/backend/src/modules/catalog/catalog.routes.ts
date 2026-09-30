import { Router } from 'express';
import { successResponse } from '../../common/types/api.js';
import { evaluateAddToCartFlow } from './addToCartFlow.service.js';
import {
  buildDishOffersNearMe,
  buildHomeFeed,
  buildProductSummaries,
  resolveCategoryBrowseSettings,
  resolveProductOffer,
  searchSuggest,
} from './catalog.service.js';

export const catalogRouter = Router();

catalogRouter.get('/category-browse', async (_req, res, next) => {
  try {
    const browse = await resolveCategoryBrowseSettings();
    if (!browse) {
      res.json(
        successResponse({
          categories: [],
          productLimit: 10,
          subcategoryLimit: 20,
          defaultSubcategorySlugByParent: {},
        }),
      );
      return;
    }
    res.json(
      successResponse({
        categories: browse.categories.map((c) => ({
          _id: c._id.toString(),
          slug: c.slug,
          name: c.name,
          parentId: c.parentId?.toString() ?? null,
        })),
        productLimit: browse.productLimit,
        subcategoryLimit: browse.subcategoryLimit,
        defaultSubcategorySlugByParent: browse.defaultSubcategorySlugByParent,
      }),
    );
  } catch (err) {
    next(err);
  }
});

catalogRouter.get('/home', async (req, res, next) => {
  try {
    const lng = req.query.lng !== undefined ? Number(req.query.lng) : undefined;
    const lat = req.query.lat !== undefined ? Number(req.query.lat) : undefined;
    const feed = await buildHomeFeed(lng, lat);
    res.json(successResponse(feed));
  } catch (err) {
    next(err);
  }
});

catalogRouter.get('/add-to-cart-flow', async (req, res, next) => {
  try {
    const productId = String(req.query.productId ?? '');
    if (!productId) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'productId required' } });
      return;
    }
    const variantId = req.query.variantId ? String(req.query.variantId) : undefined;
    const quantity = Number(req.query.quantity) || 1;
    const lng = req.query.lng !== undefined ? Number(req.query.lng) : undefined;
    const lat = req.query.lat !== undefined ? Number(req.query.lat) : undefined;
    const hasDeliveryAddress =
      req.query.hasDeliveryAddress === 'true' || req.query.hasDeliveryAddress === '1';
    const contextVendorId = req.query.contextVendorId ? String(req.query.contextVendorId) : undefined;
    const flow = await evaluateAddToCartFlow({
      productId,
      variantId,
      quantity,
      lng: lng !== undefined && !Number.isNaN(lng) ? lng : undefined,
      lat: lat !== undefined && !Number.isNaN(lat) ? lat : undefined,
      hasDeliveryAddress,
      contextVendorId,
    });
    res.json(successResponse(flow));
  } catch (err) {
    next(err);
  }
});

catalogRouter.get('/resolve-offer', async (req, res, next) => {
  try {
    const productId = String(req.query.productId ?? '');
    if (!productId) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'productId required' } });
      return;
    }
    const lng = req.query.lng !== undefined ? Number(req.query.lng) : undefined;
    const lat = req.query.lat !== undefined ? Number(req.query.lat) : undefined;
    const variantId = req.query.variantId ? String(req.query.variantId) : undefined;
    const offer = await resolveProductOffer({
      productId,
      variantId,
      lng: lng !== undefined && !Number.isNaN(lng) ? lng : undefined,
      lat: lat !== undefined && !Number.isNaN(lat) ? lat : undefined,
    });
    res.json(successResponse(offer));
  } catch (err) {
    next(err);
  }
});

catalogRouter.get('/product-summaries', async (req, res, next) => {
  try {
    const lng = req.query.lng !== undefined ? Number(req.query.lng) : undefined;
    const lat = req.query.lat !== undefined ? Number(req.query.lat) : undefined;
    const limit = Number(req.query.limit) || 24;
    const categoryId = req.query.categoryId ? String(req.query.categoryId) : undefined;
    const categorySlug = req.query.categorySlug ? String(req.query.categorySlug) : undefined;
    const q = req.query.q ? String(req.query.q) : undefined;
    const summaries = await buildProductSummaries({ lng, lat, limit, categoryId, categorySlug, q });
    res.json(successResponse(summaries));
  } catch (err) {
    next(err);
  }
});

/** Top picks / dish search: one offer row per nearby restaurant. */
catalogRouter.get('/dish-offers', async (req, res, next) => {
  try {
    const lng = req.query.lng !== undefined ? Number(req.query.lng) : undefined;
    const lat = req.query.lat !== undefined ? Number(req.query.lat) : undefined;
    const limit = Number(req.query.limit) || 40;
    const q = req.query.q ? String(req.query.q) : undefined;
    const dietRaw = req.query.diet ? String(req.query.diet) : undefined;
    const diet = dietRaw === 'veg' || dietRaw === 'nonveg' ? dietRaw : undefined;
    const offers = await buildDishOffersNearMe({
      lng: lng !== undefined && !Number.isNaN(lng) ? lng : undefined,
      lat: lat !== undefined && !Number.isNaN(lat) ? lat : undefined,
      limit,
      q,
      diet,
    });
    res.json(successResponse(offers));
  } catch (err) {
    next(err);
  }
});

catalogRouter.get('/search-suggest', async (req, res, next) => {
  try {
    const q = String(req.query.q ?? '');
    const result = await searchSuggest(q);
    res.json(successResponse(result));
  } catch (err) {
    next(err);
  }
});
