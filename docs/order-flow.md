# Order flow

1. Customer adds items to cart (`POST /cart/items`) — vendor/variant/qty validated server-side.
2. Customer checkout (`POST /checkout`) with `idempotencyKey`.
3. Backend recalculates cart, reserves inventory in a MongoDB transaction.
4. Creates **parent order** and **vendor suborders** (`VendorOrder`).
5. Creates payment record via payment provider abstraction (COD captures immediately).
6. Emits `OrderCreated` → notification handler persists in-app notification.

Order status changes use `orderStateMachine.ts` transition rules and admin `PATCH /orders/:id/status`.
