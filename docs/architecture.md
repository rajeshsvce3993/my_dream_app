# Architecture

## System overview

```mermaid
flowchart TB
  Admin[Admin Web React]
  Customer[Customer Web React]
  Mobile[Mobile Expo]
  API[Backend API Node TS]
  Mongo[(MongoDB)]
  Redis[(Redis)]
  Admin --> API
  Customer --> API
  Mobile --> API
  API --> Mongo
  API --> Redis
```

## Domain modules (backend)

| Module | Responsibility |
|--------|----------------|
| auth / users | JWT auth, sessions, RBAC |
| configuration | Admin-controlled business settings |
| categories / products | Catalog, variants, Tamil/English fields |
| vendors | GeoJSON locations, service/delivery radius |
| pricing / offers | Vendor comparison, best price engine |
| inventory | Atomic reserve/release/sale |
| cart / checkout | Multi-vendor cart, idempotent checkout |
| orders | Parent order + vendor suborders, state machine |
| payments | Provider abstraction (COD implemented) |
| notifications | Domain events → in-app notifications |
| reports | Admin dashboard aggregates |

## Checkout flow

```mermaid
sequenceDiagram
  participant C as Customer Client
  participant API as Backend
  participant DB as MongoDB
  C->>API: POST /checkout (idempotency key)
  API->>API: Recalculate cart/pricing
  API->>DB: Transaction reserve inventory
  API->>DB: Create order + vendor suborders
  API->>DB: Create payment record
  API-->>C: Order + payment intent
```

## Business configuration rule

Admin portal and configuration collections are the source of **business settings**.  
Customer web/mobile only **render API data** — no hardcoded categories, vendors, prices, or tax rates.
