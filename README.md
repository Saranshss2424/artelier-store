# Artelier

Art storefront with React/Vinext, Cloudflare Workers, D1 inventory/orders/carts, R2 product images, and Razorpay Standard Checkout. An existing Cashfree integration is preserved as an alternative.

## Current state

- Website: https://artelier-saransh.ethanhuntss.chatgpt.site
- Storefront, owner-only studio, uploads, stock, carts and cash-on-delivery flow are implemented.
- Razorpay integration is implemented but disabled until the merchant configures credentials and tests it.
- Payment integration tests use mocked provider responses. No real Razorpay transaction has been tested yet.
- The website is public, as set in the newer published version. Owner studio access remains restricted.
- Source repository: https://github.com/Saranshss2424/artelier-store.

## Accounts and services

Required: a Razorpay merchant account with completed onboarding/KYC and settlement bank details. Enable UPI and cards; request Amazon Pay and eligible pay-later methods in the dashboard. A separate integration for every UPI app is not required.

Already provided by the current hosting: database, object storage, HTTPS and Worker hosting. GitHub stores source; it does not process payments or host this server-backed shop by itself.

Optional later: custom domain, transactional email service, shipping/courier service. No separate Redis, MongoDB, or Kubernetes service is required for this implementation.

## Configuration

Store production values as hosted environment variables, never in Git:

| Variable | Purpose |
| --- | --- |
| ADMIN_EMAIL | Approved ChatGPT owner email; configured in hosting |
| ENABLE_COD | `true` only if cash on delivery is offered |
| ENABLE_ONLINE_PAYMENTS | `true` after keys and webhook setup |
| RAZORPAY_KEY_ID | Test key first; live key only after testing |
| RAZORPAY_KEY_SECRET | Server-side secret |
| RAZORPAY_WEBHOOK_SECRET | Separate secret shared with the webhook configuration |

Configure only one gateway: Razorpay is selected when explicitly enabled and configured; otherwise existing Cashfree credentials select Cashfree. Cashfree uses CASHFREE_ENV, CASHFREE_APP_ID and CASHFREE_SECRET_KEY with /api/payment/webhook. The Razorpay test suite does not establish live Cashfree compatibility.

Configure automatic payment capture in the Razorpay dashboard. Add the publicly reachable webhook URL:

`https://artelier-saransh.ethanhuntss.chatgpt.site/api/payments/webhook`

Subscribe to `payment.captured`, `order.paid`, and `refund.processed`. Keep Test and Live credentials/webhooks separate. Do not enable live collection while the site is private or contains only sample products. Supply real business contact, shipping, returns/refund and privacy information before merchant review and launch.

## Payment behavior

Server-calculated prices and a provider order ID drive checkout. Stock is reserved for 30 minutes. Checkout reclaims expired reservations synchronously; background maintenance also reclaims them through the durable job runner. Signed callbacks and signed raw-body webhooks are verified; payment amount/currency/capture status are also fetched from the provider. Duplicate confirmations do not create duplicate orders or reduce stock again.

After an expired reservation, a late capture tries to allocate stock again. If stock is no longer available, the order is marked **Refund required** and cannot be marked shipped. The owner must issue the refund in the Razorpay dashboard; full-refund events update the order. Refunds do not automatically replenish fulfilled stock. Partial refunds and disputes are managed in the Razorpay dashboard.

Payment method availability is controlled by Razorpay approval, customer eligibility and device support. Do not advertise every UPI app or every pay-later provider as guaranteed. Amazon Pay wallet is distinct from Amazon Pay Later.

## Validation

- `node tests/payments.test.mjs` — actual payment state logic against in-memory SQLite and mocked provider responses
- `node node_modules/typescript/bin/tsc --noEmit`
- `pnpm build`

Tests cover trusted pricing, stock exhaustion, duplicate create/capture, idempotent expiry, late payment allocation, refund-required transitions, refund reconciliation, mismatched amounts, HMAC tampering and bounded request bodies.

Before launch, test hosted Razorpay Test Mode on mobile and desktop: successful payment, cancellation/failure/retry, delayed confirmation, webhook replay, reload recovery, expired stock and refund. Then load-test using an agreed traffic target. Current rate limits and indexed queries are not a verified traffic-capacity guarantee.

## Development

Use Node 22.13+ and the pinned package manager in package.json. Install with `pnpm install --frozen-lockfile`, copy `.env.example` to `.env`, and run `pnpm dev`. Hosting uses `.openai/hosting.json`; production schema changes live in immutable Drizzle migrations. Do not rewrite previously applied migrations.

## Sources

- https://razorpay.com/docs/payments/payment-methods/
- https://razorpay.com/docs/payments/payment-methods/wallets/
- https://razorpay.com/docs/payments/payment-methods/pay-later/
- https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/
- https://razorpay.com/docs/webhooks/validate-test/

Sample artwork sources are in IMAGE-SOURCES.md. Replace demonstration images and products with the owner's approved work before commercial launch.

## Marketplace roadmap

See [the proposed architecture](docs/ARCHITECTURE-ROADMAP.md) for the owner’s multi-vendor art marketplace requirements and the boundary between implemented features and planned services.

## Tracking and operations

Customer order tracking, owner courier details, short-lived catalog caching and durable webhook jobs are implemented. See [operations and scheduler setup](docs/OPERATIONS.md) for exact limits, tests and remaining integrations. The optional scheduled runner still needs its shared secret configured. Live courier tracking and production load capacity are not yet verified.

## Customer accounts and shopping

Customers can sign in with ChatGPT, save addresses, maintain a wishlist, view linked purchases across devices, submit verified delivered-purchase reviews, and request returns. Product pages include related pieces and moderated ratings; the studio handles review moderation, return requests and basic operating summaries. See [operations](docs/OPERATIONS.md) for limits, sign-in behavior, and features requiring further integration.
