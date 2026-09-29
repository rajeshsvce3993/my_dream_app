# Pricing

Pricing is computed on the backend in `pricing.service.ts`:

- Loads active `VendorProduct` mappings and inventory
- Applies active `Offer` records (percentage/fixed, min quantity)
- Applies tax from configuration key `tax.defaultRate`
- Ranks vendors using weights from `vendor.ranking.weights`

Clients must never send authoritative prices. Cart and checkout endpoints recalculate totals on every request.
