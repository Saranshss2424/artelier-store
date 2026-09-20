# Tracking and traffic handling

## Shipped behavior

- `/orders` shows this browser's orders; full UUID reference plus checkout email retrieves an order from another device. Responses omit addresses, phone numbers and payment identifiers and are never cached. Keep references private. This is guest order lookup, not an authenticated customer account or OTP flow.
- Owner studio saves carrier, tracking number, HTTPS courier link and forward-only order status. Database triggers record new status changes transactionally. Existing orders show their current state; history before this migration is unavailable. Courier status is entered manually: there is no live courier API integration.
- `/api/catalog` caches public product data at each Cloudflare edge for 15 seconds. Cart and order data are separate and `no-store`. Edits clear the local edge entry; other locations expire within 15 seconds. Checkout always rechecks authoritative database prices and stock; a cached availability label is never a reservation. Cache failures fall back to the database.
- Signed Razorpay and Cashfree webhooks are inserted into a durable D1 queue before acknowledgment. Payloads store only reconciliation identifiers and minimal payment fields. Razorpay processing fetches the provider's current payment state. Cashfree uses the verified signed event.
- Atomic job claims allow at most four active jobs, with 90-second leases, ownership tokens, exponential retry backoff, and a dead-letter state after six attempts. Handlers are idempotent; this is at-least-once processing. Interrupted jobs recover after lease expiry. The owner can inspect recent jobs and retry dead letters from the studio. Completed jobs are retained for seven days with bounded cleanup; dead letters remain until reviewed.
- Webhooks and shop/order reads trigger bounded post-response processing. A run starts at most two jobs; each payment API request has a 15-second timeout. Browser-independent scheduling requires the setup below.
- Rate limits: 60 writes/minute/IP; 180 shop reads/minute/IP; 120 order-history reads/minute/IP; 10 guest order lookups/minute/IP. Catalog edge hits bypass database rate-limit writes. Limits return 429; order/shop endpoints include Retry-After. These are application limits, not a WAF or DDoS guarantee.
- `/api/health` checks database reachability and returns 200/503 without secrets. Queue failures emit structured error logs. The owner studio shows recent job states. External uptime monitoring and alerts are not connected.

## Enable unattended processing

1. Generate a cryptographically random secret (at least 32 bytes).
2. Store it as the hosted Site secret `JOB_RUNNER_SECRET` and as the GitHub Actions repository secret of the same name. Do not put it in source, chat, URLs or logs.
3. Enable the repository's **Process Artelier background jobs** workflow. It POSTs to `/api/jobs` every five minutes and supports manual execution. GitHub schedules may be delayed; use a dedicated scheduler for stricter latency/throughput targets. Without this configuration, retries only run when visitors, webhooks or the owner trigger processing.
4. Use an uptime service to check `/api/health`; configure notifications there. Set alerts for dead letters and sustained queue age using your hosting's logs/monitoring integration before a high-traffic launch.
5. For live courier updates, select and onboard a courier/aggregator and configure authenticated tracking webhooks. No courier account is connected yet.

The managed Site exposes D1 and R2; a native Cloudflare Queues consumer, Cron Trigger, WAF rules and a multi-origin load balancer are not provisioned by this release. The durable D1 queue shares the database with orders. If measured load outgrows it, migrate jobs to a managed queue and place rate limiting ahead of database writes. Cloudflare's hosting handles Worker request distribution; this does not establish a measured capacity or database failover guarantee.

## Verification

- `node tests/payments.test.mjs`: provider-mocked pricing, payment/stock reconciliation, idempotency, and 25 simultaneous attempts for one original (one reservation succeeds).
- `node tests/operations.test.mjs`: real SQLite migrations/triggers, queue concurrency and leases, retries/dead letters, order privacy, index usage, public catalog cache isolation and invalidation. Cache tests use a mock Cache API.
- `node scripts/load-check.mjs <staging-catalog-url> --allow-remote`: bounded read-only load check; default 100 requests at concurrency 10. Set REQUESTS (max 500) and CONCURRENCY (max 50) for a controlled staging test. Do not treat a local run as production capacity evidence.
- TypeScript and production build must pass before publication.

Before claiming a supported peak, agree expected concurrent visitors, browse/checkout mix, order volume and latency targets. Run sustained staging tests with realistic inventory and test-gateway traffic; measure p95 latency, error rates, D1 saturation, queue age and recovery. No production stress test or live gateway payment was performed for this release.
