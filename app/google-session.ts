import { env } from "cloudflare:workers";

// Identity is always derived from a verified Google ID token, never from client headers.
const SESSION_COOKIE = "__Host-artelier-session";
const NONCE_COOKIE = "__Host-artelier-google-nonce";
const SESSION_SECONDS = 7 * 24 * 60 * 60;

type Session = { sub: string; email: string; name: string | null; exp: number };
type GoogleClaims = {
  iss: string; aud: string | string[]; exp: number; iat: number; nbf?: number;
  sub: string; email: string; email_verified: boolean; name?: string; nonce?: string;
};

function config() {
  const e = env as Record<string, unknown>;
  return {
    clientId: String(e.GOOGLE_CLIENT_ID || "").trim(),
    secret: String(e.GOOGLE_SESSION_SECRET || "").trim(),
    allowedOrigins: String(e.GOOGLE_ALLOWED_ORIGINS || "").split(",").map(x => x.trim()).filter(Boolean),
  };
}

export function googlePublicConfig() {
  const c = config();
  return { clientId: c.clientId, configured: !!c.clientId && c.secret.length >= 32 };
}

function bytesToBase64Url(input: Uint8Array): string {
  let s = "";
  for (const n of input) s += String.fromCharCode(n);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function base64UrlToBytes(input: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(input) || input.length > 16384) throw new Error("Invalid token");
  const padded = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}
function jsonPart<T>(part: string): T {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(part))) as T;
}
function cookieValue(cookieHeader: string | null, key: string): string | null {
  const item = (cookieHeader || "").split(";").map(v => v.trim()).find(v => v.startsWith(key + "="));
  return item ? item.slice(key.length + 1) : null;
}
async function hmacKey(): Promise<CryptoKey> {
  const secret = config().secret;
  if (secret.length < 32) throw new Error("Google session secret not configured");
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export function randomNonce(): string {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}
export function nonceCookie(nonce: string): string {
  return `${NONCE_COOKIE}=${nonce}; Path=/; Max-Age=300; Secure; HttpOnly; SameSite=Strict`;
}
export function clearNonceCookie(): string {
  return `${NONCE_COOKIE}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Strict`;
}
export function getNonceFromRequest(req: Request): string | null {
  return cookieValue(req.headers.get("cookie"), NONCE_COOKIE);
}
export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax`;
}
export async function makeSessionCookie(claims: GoogleClaims): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: Session = { sub: claims.sub, email: claims.email, name: claims.name?.slice(0, 120) || null, exp: now + SESSION_SECONDS };
  const data = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = bytesToBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(), new TextEncoder().encode(data))));
  return `${SESSION_COOKIE}=${data}.${signature}; Path=/; Max-Age=${SESSION_SECONDS}; Secure; HttpOnly; SameSite=Lax`;
}
export async function readGoogleSession(cookieHeader: string | null): Promise<Session | null> {
  try {
    const token = cookieValue(cookieHeader, SESSION_COOKIE);
    if (!token || token.length > 8192) return null;
    const [data, sig, extra] = token.split(".");
    if (!data || !sig || extra) return null;
    if (!await crypto.subtle.verify("HMAC", await hmacKey(), base64UrlToBytes(sig), new TextEncoder().encode(data))) return null;
    const value = jsonPart<Session>(data);
    const now = Math.floor(Date.now() / 1000);
    if (!value.sub || !value.email || typeof value.exp !== "number" || value.exp <= now || value.exp > now + SESSION_SECONDS) return null;
    return value;
  } catch {
    return null;
  }
}

export function safeReturnPath(path: string | null): string {
  if (!path?.startsWith("/") || path.startsWith("//") || path.includes("\\")) return "/";
  try {
    const u = new URL(path, "https://artelier.local");
    if (u.origin !== "https://artelier.local" || ["/login", "/api/auth/google"].includes(u.pathname)) return "/";
    return u.pathname + u.search + u.hash;
  } catch { return "/"; }
}

export function isAllowedLoginOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const self = new URL(req.url).origin;
  return origin === self || config().allowedOrigins.includes(origin);
}

export async function verifyGoogleCredential(credential: string, nonce: string): Promise<GoogleClaims> {
  const cfg = config();
  if (!cfg.clientId || cfg.secret.length < 32) throw new Error("Google sign-in is not configured");
  if (credential.length > 12000) throw new Error("Invalid credential");
  const parts = credential.split(".");
  if (parts.length !== 3) throw new Error("Invalid credential");
  const header = jsonPart<{ alg: string; kid: string }>(parts[0]);
  const claims = jsonPart<GoogleClaims>(parts[1]);
  if (header.alg !== "RS256" || typeof header.kid !== "string") throw new Error("Invalid token algorithm");
  const now = Math.floor(Date.now() / 1000);
  if (!["accounts.google.com", "https://accounts.google.com"].includes(claims.iss) ||
    claims.aud !== cfg.clientId || !Number.isFinite(claims.exp) || claims.exp <= now ||
    !Number.isFinite(claims.iat) || claims.iat > now + 60 || claims.iat < now - 3600 ||
    (claims.nbf && claims.nbf > now + 60) ||
    claims.nonce !== nonce || !claims.sub ||
    typeof claims.email !== "string" || claims.email_verified !== true) throw new Error("Untrusted Google credential");
  const response = await fetch("https://www.googleapis.com/oauth2/v3/certs", { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Google key verification unavailable");
  const jwks = await response.json() as { keys: Array<JsonWebKey & { kid?: string }> };
  const jwk = jwks.keys.find(k => k.kid === header.kid && k.kty === "RSA");
  if (!jwk) throw new Error("Google verification key unavailable");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const verified = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, base64UrlToBytes(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]));
  if (!verified) throw new Error("Invalid Google signature");
  return claims;
}
