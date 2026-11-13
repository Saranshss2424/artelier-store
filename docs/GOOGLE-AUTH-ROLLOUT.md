# Google sign-in rollout for Artelier

## What changed

- Buyer account, seller applications, and owner studio now use a real **Continue with Google** entry point at `/login`.
- Google Identity Services returns a signed Google ID token; the server validates the token's signature against Google's public JWKs plus issuer, client ID (audience), expiration, subject, verified email and a per-request nonce.
- The application creates its **own HMAC-signed, HttpOnly, Secure, SameSite=Lax session cookie**, scoped to the application host. Cookie is read server-side; client-supplied login headers and IDs are not accepted.
- Existing account/seller/studio APIs keep their server-side authorization checks. The administrator is still restricted by `ADMIN_EMAIL`.
- Logout clears the application cookie. No passwords or Google tokens are stored in the application database.

## Google Cloud Console setup (required before enabling)

1. In Google Cloud Console, select or create a project. Configure OAuth consent / branding. Use a company support email and add test users if the app is still in testing mode.
2. Under **APIs & Services → Credentials**, create an **OAuth client ID → Web application**.
3. Add the actual production website **origin** (scheme and hostname, no path) to **Authorized JavaScript origins**. For a temporary internal test: `https://artelier-saransh.vercel.app` only if that hostname is verified to run the application auth endpoints end-to-end, NOT merely a reverse proxy.
4. Save the **OAuth client ID** in the application hosting environment as `GOOGLE_CLIENT_ID`.
5. Generate a random session signing secret of **at least 32 characters** and save it in the hosting environment as `GOOGLE_SESSION_SECRET`. Example generation: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. Do not put the secret in Git or frontend JavaScript.
6. Set `ADMIN_EMAIL` to the email of the Google account approved for store administration.
7. Build and deploy the application to its **real application host** and verify that `/api/auth/google?mode=config` returns `configured: true`. This must be hosted where cookies and Google requests share the same origin.
8. Test buyer login, seller application, seller approval, owner admin access, logout, wrong-account access, and rejected/tampered credentials. Test on mobile and an incognito browser.

## Important hosting constraints

The current `artelier-saransh.vercel.app` deployment is a **reverse proxy** to a ChatGPT Site, not an independently migrated Cloudflare application. Vercel's URL alone does not create first-party login, cookie isolation, or a working Google configuration. The safest route is to bind an owned custom domain directly to the actual application host, or properly migrate the Cloudflare Workers + D1 + R2 application to an independent host with new OAuth settings.

**Do not merge or publish this branch to production before the actual host is configured.** Until then, the login page intentionally reports that Google sign-in is not configured.

## Existing account data

Previous accounts are identified by ChatGPT-provided user IDs. New accounts are identified by the stable Google `sub` prefixed with `google:`. Existing saved addresses, orders and seller records **will not automatically appear** after changing providers. Plan a verified, owner-reviewed account-linking/migration process if preserving historic customer records is important. Never link existing accounts using an unverified email alone.

## Security limitations and follow-up

- Existing customer and payment test suites remain in the repo. This branch passes TypeScript, customer and payment checks; live Google OAuth end-to-end is still **untested** because credentials and the application-host deployment are not configured.
- Keep session secret, OAuth settings and merchant payment credentials out of the repository.
- Do not use a reverse proxy as a substitute for migrating authentication. Configure a proper domain at the actual host.
