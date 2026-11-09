import { createHmac, timingSafeEqual } from "node:crypto";

export const RESEND_API = "https://api.resend.com";

/**
 * Resend webhook signature (Standard Webhooks / Svix): base64 HMAC-SHA256 over
 * `${id}.${timestamp}.${rawBody}`, keyed with the base64 part of the `whsec_…` secret.
 * The signature header holds space-separated `v1,<base64>` entries (several during key rotation).
 * Rejects stale timestamps (replay protection).
 */
export function verifyResendSignature(
  secret: string,
  h: { id: string | null; timestamp: string | null; signature: string | null },
  rawBody: string,
  now = Date.now(),
  maxAgeSeconds = 5 * 60,
): boolean {
  if (!secret || !h.id || !h.timestamp || !h.signature) return false;
  const ts = Number(h.timestamp);
  if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > maxAgeSeconds) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = Buffer.from(
    createHmac("sha256", key).update(`${h.id}.${h.timestamp}.${rawBody}`).digest("base64"),
  );
  return h.signature.split(" ").some((part) => {
    const [version, sig] = part.split(",", 2);
    if (version !== "v1" || !sig) return false;
    const given = Buffer.from(sig);
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

/** Reads the webhook headers (Resend sends `svix-*`; `webhook-*` is the Standard Webhooks spelling). */
export function resendSignatureHeaders(headers: Headers) {
  return {
    id: headers.get("svix-id") ?? headers.get("webhook-id"),
    timestamp: headers.get("svix-timestamp") ?? headers.get("webhook-timestamp"),
    signature: headers.get("svix-signature") ?? headers.get("webhook-signature"),
  };
}

export type ResendReceivedEmail = {
  id: string;
  from: string;
  to: string[];
  subject: string;
  created_at: string;
  html: string | null;
  text: string | null;
  headers: Record<string, string> | null;
  message_id: string;
};

/** Full content of a received email (the `email.received` webhook carries metadata only). */
export async function fetchReceivedEmail(apiKey: string, id: string): Promise<ResendReceivedEmail> {
  const res = await fetch(`${RESEND_API}/emails/receiving/${encodeURIComponent(id)}`, {
    headers: { authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(20_000),
  });
  const body = (await res.json().catch(() => ({}))) as ResendReceivedEmail & { message?: string };
  if (!res.ok) throw new Error(`Resend ${res.status}: ${body.message ?? "nelze načíst přijatý e-mail"}`);
  return body;
}

/** Case-insensitive header lookup (received headers keep the sender's spelling). */
export function headerOf(headers: Record<string, string> | null | undefined, name: string): string | null {
  if (!headers) return null;
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) if (k.toLowerCase() === lower) return v;
  return null;
}
