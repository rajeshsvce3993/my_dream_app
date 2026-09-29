# Loading FreshMart database data

Development catalog data lives in:

`data/freshmart-seed.json`

It includes:

- Public UI brand configuration (`brand.name`, `brand.tagline`, currency)
- Categories (Fruits & Vegetables, Groceries, Dairy, …)
- Vendors (Fresh Farm Mart, Quality Grocers, Green Bazaar)
- Products with English/Tamil names, images, variants
- Vendor-specific pricing and inventory per variant

## Load into MongoDB

1. Start MongoDB (Docker Desktop + `docker compose up -d mongodb`).
2. Ensure `.env` has `MONGODB_URI`.
3. Run from backend:

```bash
cd apps/backend
npm run seed
```

The seed script:

1. Upserts roles/permissions
2. Loads `data/freshmart-seed.json` via `loadFreshmartSeed.ts`

## Admin login (after seed)

- Email: `admin@freshmart.local`
- Password: `Admin@12345`

Legacy admin `admin@dream.local` is still created if missing.

## Edit seed data

Change `data/freshmart-seed.json` and re-run `npm run seed`. Existing records are upserted by stable keys (`slug`, `sku`, `code`).
