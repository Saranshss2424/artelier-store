# Art marketplace architecture roadmap

Target GitHub repository: [Saranshss2424/artelier-store](https://github.com/Saranshss2424/artelier-store).

This document records the owner's proposed marketplace architecture. It is a roadmap, not a claim that these services are deployed or connected.

## Current implementation

The existing shop uses React/Vinext, Cloudflare Workers, D1 and R2. It includes an owner-only product studio, product images, stock counts, saved carts, orders, and cash-on-delivery handling. Razorpay checkout and an existing Cashfree alternative are implemented but require provider configuration and real integration testing. The database remains the authority for stock, with atomic updates and expiring payment reservations. Current reservations last 30 minutes; the proposed marketplace flow calls for 15 minutes.

There is no multi-vendor onboarding, seller payout system, escrow service, certificate issuance, ownership registry, insured freight quotation, vector discovery, media-processing worker, or AR feature yet.

## Proposed target domains

| Domain | Proposed services | Delivery scope |
| --- | --- | --- |
| Catalog | PostgreSQL | Artists, artwork, original/edition identity, medium, dimensions, frames and prices |
| Media | S3, asynchronous processing, Lambda, CloudFront | Restricted originals, watermarked derivatives and optimized thumbnails |
| Discovery | Elasticsearch and Qdrant | Attribute/text search and visual similarity |
| Reservations | Redis plus transactional inventory authority | 15-minute exclusive reservations for originals; expiry and late-payment handling |
| Orders and provenance | PostgreSQL and managed signing keys | Auditable order ledger, edition identifiers, certificate issuance and ownership events |
| Marketplace settlements | Approved marketplace payment provider | Seller onboarding, commissions, transfer eligibility, refunds and payout reconciliation |
| Shipping | Insured courier/freight integrations | Quotes, dimensions, declared value, insurance, crating, labels and delivery events |
| Room previews | Separate preview pipeline | Scaled wall visualization; AR/model generation is a separately scoped feature |

## Design decisions to resolve before implementation

- Keep the database authoritative for allocation. Evaluate Redis/Redlock only as coordination; specify fencing, uniqueness constraints, recovery and payment-race behavior before adopting it.
- Treat marketplace settlement, delayed transfers and regulated escrow as separate requirements. Confirm the provider's Indian merchant, seller and payment-method eligibility before selecting Stripe Connect or an alternative.
- Define who verifies authenticity and which evidence is required. A signed certificate records an issuer's assertion; the product needs an explicit verification workflow.
- Scope wall previews separately from actual 3D asset production. Confirm supported artwork types, dimensions and device requirements.
- Confirm return policy and settlement rules. The proposed seven-day inspection window is not an adopted shop policy.
- Obtain courier capabilities and commercial terms before promising automatic crating, insurance, duties or white-glove quotes.
- Establish traffic, upload-size, latency, availability and recovery targets before adopting multiple search/datastore services.

## Proposed purchase lifecycle

1. Search or browse artwork; optionally preview it in a room.
2. Atomically reserve the artwork for 15 minutes.
3. Create and reconcile a provider payment using idempotent order identifiers.
4. Confirm stock allocation and initiate insured fulfillment.
5. Process verified delivery, the agreed inspection window, eligible seller settlement and certificate issuance.

Every step needs failure and reconciliation states: abandoned checkout, delayed payment, duplicate provider events, damaged shipment, returns, refunds, payout failure and disputes.

## Suggested delivery sequence

1. Complete the current single-seller launch: real inventory, merchant account, test payments, business policies and measured traffic testing.
2. Add artwork dimensions, editions and the asynchronous media pipeline.
3. Add artist onboarding, isolated seller permissions and financial-ledger design.
4. Integrate approved seller settlements and insured shipping.
5. Add verified provenance/certificates, visual search and room previews.

Do not provision paid external infrastructure or represent payment-provider approval as complete until those integrations are explicitly configured and verified.
