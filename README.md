# Dream Commerce

Production-oriented **multi-vendor e-commerce platform** with:

- **Backend API** — Node.js, TypeScript, Express, MongoDB, Redis
- **Admin web** — React + Vite (business configuration via API only)
- **Customer web** — React + Vite (English/Tamil, vendor comparison, multi-vendor cart/checkout)
- **Mobile** — Expo Router customer app (API-driven, secure token storage)

## Quick start (local)

### 1. Infrastructure

```bash
docker compose up -d mongodb redis
```

### 2. Backend

```bash
cd apps/backend
copy ..\\..\\.env.example ..\\..\\.env   # PowerShell: adjust secrets
npm install
npm run seed
npm run dev
```

API: `http://localhost:4000/api/v1`  
Swagger UI: `http://localhost:4000/api-docs`

FreshMart sample data is loaded from `data/freshmart-seed.json` (see `docs/data-loading.md`).

Default admin (after seed):

- Email: `admin@freshmart.local`
- Password: `Admin@12345`

### 3. Admin web

```bash
cd apps/admin-web
npm install
npm run dev
```

### 4. Customer web

```bash
cd apps/customer-web
npm install
npm run dev
```

### 5. Mobile

```bash
cd apps/mobile
npm install
set EXPO_PUBLIC_API_URL=http://localhost:4000/api/v1
npm run start
```

## Architecture highlights

- **Server-authoritative checkout** — prices, tax, shipping, inventory validated on backend
- **Multi-vendor orders** — parent order + vendor suborders
- **Geospatial vendor discovery** — MongoDB `2dsphere` + configurable ranking weights
- **RBAC** — data-driven roles/permissions
- **Modular monolith** — microservice-ready module boundaries

See `docs/architecture.md` for diagrams and flows.

## Scripts

| Location | Command | Purpose |
|----------|---------|---------|
| `apps/backend` | `npm test` | Unit tests |
| `apps/backend` | `npm run seed` | Development seed data |
| `apps/backend` | `npm run build` | Production build |

## Environment

Copy `.env.example` to `.env` and set strong JWT secrets (32+ characters).

Never commit secrets or place payment private keys in mobile/web clients.
