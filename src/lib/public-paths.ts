// Paths reachable without a session. Everything else requires the admin login.
// Non-session routes authenticate themselves:
//  - /api/auth/*      Auth.js endpoints
//  - /api/webhooks/*  verified by provider signature (Mailgun)
//  - /api/cron/*      verified by CRON_SECRET bearer token
//  - /unsubscribe/*   verified by a signed token in the URL
const PUBLIC_PREFIXES = ["/api/auth/", "/api/webhooks/", "/api/cron/", "/unsubscribe/"];
const PUBLIC_EXACT = new Set(["/login"]);

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
