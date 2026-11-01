import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Mailgun webhook signature: HMAC-SHA256(signingKey, timestamp + token) as hex.
 * Rejects stale timestamps (replay protection).
 */
export function verifyMailgunSignature(
  signingKey: string,
  sig: { timestamp: string; token: string; signature: string },
  now = Date.now(),
  maxAgeSeconds = 15 * 60,
): boolean {
  if (!signingKey || !sig.timestamp || !sig.token || !sig.signature) return false;
  const ts = Number(sig.timestamp);
  if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > maxAgeSeconds) return false;
  const expected = createHmac("sha256", signingKey)
    .update(sig.timestamp + sig.token)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(sig.signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Splits a References / In-Reply-To header into message IDs. */
export function parseMessageIds(header: string | null | undefined): string[] {
  return header?.match(/<[^>]+>/g) ?? [];
}
