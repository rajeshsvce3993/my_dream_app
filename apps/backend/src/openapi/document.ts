export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Dream Commerce API',
    version: '1.0.0',
    description: 'Multi-vendor e-commerce REST API',
  },
  servers: [{ url: '/api/v1' }],
  paths: {
    '/auth/register': {
      post: { summary: 'Customer registration', tags: ['Auth'] },
    },
    '/auth/login': {
      post: { summary: 'Login', tags: ['Auth'] },
    },
    '/products': {
      get: { summary: 'List products', tags: ['Products'] },
      post: { summary: 'Create product (admin)', tags: ['Products'] },
    },
    '/products/{id}/vendor-comparison': {
      get: { summary: 'Compare vendors for a variant', tags: ['Products'] },
    },
    '/cart': {
      get: { summary: 'Get cart with server-calculated totals', tags: ['Cart'] },
    },
    '/checkout': {
      post: { summary: 'Server-authoritative checkout', tags: ['Checkout'] },
    },
    '/orders/my': {
      get: { summary: 'Customer order history', tags: ['Orders'] },
    },
    '/configuration/public': {
      get: { summary: 'Public business configuration', tags: ['Configuration'] },
    },
    '/vendors': {
      get: { summary: 'List vendors (location-aware customer listing when lng/lat provided)', tags: ['Vendors'] },
    },
    '/vendors/{vendorId}': {
      get: { summary: 'Vendor store profile', tags: ['Vendors'] },
    },
    '/vendors/{vendorId}/products': {
      get: { summary: 'Vendor-scoped product catalog', tags: ['Vendors'] },
    },
    '/vendors/{vendorId}/products/{vendorProductId}': {
      get: { summary: 'Vendor product detail', tags: ['Vendors'] },
    },
    '/vendor-products': {
      get: { summary: 'Admin: list vendor catalog mappings', tags: ['Vendor Products'] },
      post: { summary: 'Admin: assign global product to vendor', tags: ['Vendor Products'] },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
};
