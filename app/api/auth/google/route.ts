import {
  clearNonceCookie, clearSessionCookie, getNonceFromRequest, googlePublicConfig,
  isAllowedLoginOrigin, makeSessionCookie, nonceCookie, randomNonce,
  safeReturnPath, verifyGoogleCredential
} from "@/app/google-session";

export const dynamic = "force-dynamic";
function json(data: unknown, status = 200, cookies: string[] = []): Response {
  const h = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  for (const cookie of cookies) h.append("Set-Cookie", cookie);
  return new Response(JSON.stringify(data), { status, headers: h });
}
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode");
  if (mode === "config") return json(googlePublicConfig());
  if (mode === "nonce") {
    if (!googlePublicConfig().configured) return json({ error: "Google sign-in is not configured." }, 503);
    const nonce = randomNonce();
    return json({ nonce }, 200, [nonceCookie(nonce)]);
  }
  if (mode === "logout") {
    return new Response(null, { status: 303, headers: { Location: safeReturnPath(url.searchParams.get("return_to")), "Set-Cookie": clearSessionCookie(), "Cache-Control": "no-store" } });
  }
  return json({ error: "Not found" }, 404);
}
export async function POST(req: Request): Promise<Response> {
  if (!isAllowedLoginOrigin(req)) return json({ error: "Invalid login origin" }, 403);
  if (!req.headers.get("content-type")?.startsWith("application/json")) return json({ error: "Invalid request" }, 415);
  const expectedNonce = getNonceFromRequest(req);
  if (!expectedNonce || expectedNonce.length < 32) return json({ error: "Your sign-in session expired. Refresh and try again." }, 403);
  try {
    if (Number(req.headers.get("content-length") || "0") > 16000) return json({ error: "Invalid request" }, 413);
    const data = await req.json() as { credential?: unknown };
    if (typeof data.credential !== "string") return json({ error: "Invalid Google credential" }, 400);
    const claims = await verifyGoogleCredential(data.credential, expectedNonce);
    const session = await makeSessionCookie(claims);
    return json({ ok: true }, 200, [clearNonceCookie(), session]);
  } catch (error) {
    console.warn("Google authentication rejected", error instanceof Error ? error.message : "invalid token");
    return json({ error: "Google sign-in could not be verified. Please try again." }, 401, [clearNonceCookie()]);
  }
}
