# Email, courier tracking and artist transfers

These integrations are implemented but disabled/unconnected until provider credentials are configured. No live emails, shipment bookings or money transfers were performed during implementation. Automated tests use mocked HTTP providers and real SQLite migrations.

## Activate securely

Set secrets in the site's runtime environment settings, never GitHub source or browser forms. Redeploy when the environment settings require it.

| Connection | Required configuration | Provider setup |
| --- | --- | --- |
| Resend | `RESEND_API_KEY`, `EMAIL_FROM`, `ENABLE_EMAIL=true` | Verify your sending domain and sender. First test with an address you control. |
| Shiprocket | `SHIPROCKET_TOKEN` | Create a dedicated API user and generate a bearer token. Rotate it before expiration. Book shipments in Shiprocket, then attach their AWBs in Studio. |
| Razorpay Route | Existing Razorpay keys, `ENABLE_ARTIST_TRANSFERS=true`, `ARTIST_HOLD_DAYS` positive whole days | Route activation, verified linked accounts for each artist, agreed commission and inspection/return policy. Validate in Razorpay test mode first. |
| Continuous jobs | Existing `JOB_RUNNER_SECRET` and the scheduled workflow secret | Enable the existing five-minute job runner. Without it, maintenance is triggered by visits, webhooks or the owner and timing is not guaranteed. |

## Owner workflow

Studio → Connected operations shows configuration flags, not proof that provider credentials are valid.

1. Add each artist's display name, provider linked account ID and agreed commission. Assign artwork before accepting orders. Existing orders cannot be reassigned retroactively.
2. New orders snapshot the artist account, commission and earnings in integer paise. Razorpay snapshots at reservation; other methods snapshot at order creation. A mixed-artist order produces separate account transfers. Fractional paise are rounded down for artist earnings. Unassigned products remain platform sales.
3. New order status events enter a durable email outbox. The existing queue submits plain-text transactional emails; disabled notifications are recorded as skipped during maintenance. No historical orders are backfilled. Pending messages may await maintenance, so inspect the outbox when enabling email. “Sent” means API acceptance, not inbox delivery; bounce/delivery webhooks are not included.
4. Book and insure parcels in Shiprocket, then select a confirmed/shipped order and attach its AWB. Artelier polls the authenticated tracking API, validates the returned AWB, and advances fulfillment to shipped/delivered. Polling is scheduled at approximately 15-minute intervals when the job runner is active; queue backlog can add delay. This does not book shipments, buy labels, calculate freight, or promise insurance. Existing customer order pages show the tracking reference and status history.
5. Review artist earnings after delivery and the configured inspection period. Release requires a captured, unrefunded Razorpay payment, a paid order, and no return except one explicitly declined. Closed returns also block release: closing a support case does not prove money is owed. COD/Cashfree settlement is manual and cannot use this release action.
6. Clicking “Release artist funds” is the owner's money-movement action. No automatic release is scheduled. Transfers go to linked accounts; provider bank settlement is separate. These accounting holds do not create a regulated escrow account or guarantee funds remain available in the merchant balance. Confirm the settlement arrangement with Razorpay before activation.

## Reliability and operational boundaries

- Email payload and first-attempt time are persisted before submission. Retries reuse the exact payload and Resend idempotency key. Attempts beyond 23 hours stop for review because Resend keys expire after 24 hours. Provider errors use the existing bounded retry queue. Do not manually resend uncertain emails without checking the provider dashboard.
- Payout submission uses a unique, durable per-order claim before the HTTP call. Concurrent/repeated clicks cannot create a second app submission. A timeout, interrupted process or ambiguous response must be reconciled with read-only provider queries; there is no blind automatic retry. Partial, failed, reversed or missing transfers require provider-dashboard investigation. “Submitted” is not “settled”.
- Refunds arriving after transfer need explicit provider reversal/recovery. Returns opened after release require manual finance review. There is no automatic transfer reversal, dispute handling, tax withholding/GST invoicing or bank-settlement reconciliation in this version.
- Allocation gross/net values represent merchandise only under the current cart model. Confirm who bears gateway fees, shipping, taxes and refunds before agreeing artist commissions.
- All integration controls require owner identity and same-origin writes. Credentials never return from the API. No buyer addresses are included in the email outbox beyond its private database snapshot; public endpoints do not expose it.
- Token expiry/provider failures appear as queue errors; refresh credentials then retry through Operations. A scheduler is required for unattended updates. No live-provider acceptance test or production load-capacity guarantee has been completed.

## API references checked

- Resend send: https://resend.com/docs/api-reference/emails/send-email
- Resend 24-hour idempotency: https://resend.com/docs/dashboard/emails/idempotency-keys
- Shiprocket API: https://apidocs.shiprocket.in/ (`GET /v1/external/courier/track/awb/{awb}`)
- Razorpay Route transfers: https://razorpay.com/docs/api/payments/route/create-transfers-payments/

Run `node --test tests/integrations.test.mjs` for the focused regression checks, alongside the existing payment, operations and customer tests.

## Seller roles and custom domain

Buyers use `/account` and cannot create/edit products or upload photos. `/sell` is a separate seller application and dashboard. Applications start Pending; only the owner can approve/reject/suspend them through `/studio`. Approval links an owner-created artist payout profile (provider KYC remains external). Approved sellers may upload their own images and create/edit only their own listings. Listings start hidden, and every seller edit hides them for owner review. Suspension revokes writing and hides the seller's listings. Seller clients cannot set approval, active visibility, artist account or commission. Seller order handling remains owner-managed in this version.

To remove `chatgpt.site` from the address, connect a domain owned by the store through Sites custom domains, apply the returned DNS verification/routing records at its registrar, and wait for validation/TLS. No domain was purchased or invented. Set `PUBLIC_SITE_URL` to the verified HTTPS origin so order email links use that domain, then redeploy. Sign-in retains its existing ChatGPT identity provider; custom branding of the hostname does not replace authentication.
