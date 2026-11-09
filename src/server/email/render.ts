// Template rendering, unsubscribe tokens and plain-text → HTML. Pure functions (unit tested).
import { createHmac, timingSafeEqual } from "node:crypto";

export const UNSUBSCRIBE_PLACEHOLDER = "{{unsubscribeUrl}}";

/** Replaces {{name}} placeholders; unknown ones are left in place so they can be detected. */
export function renderTemplate(template: string, vars: Record<string, string | null | undefined>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (m, key: string) => {
    const v = vars[key];
    return v === undefined || v === null ? m : v;
  });
}

/** Placeholders still present in a text, e.g. ["previewUrl"]. `unsubscribeUrl` is filled at send time. */
export function unresolvedPlaceholders(text: string): string[] {
  return [...new Set([...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))].filter(
    (k) => k !== "unsubscribeUrl",
  );
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Extracts the bare address from "Name <a@b.cz>" or "a@b.cz". */
export function addressOf(value: string): string {
  return normalizeEmail(value.match(/<([^>]+)>/)?.[1] ?? value);
}

/** Display name from "Name <a@b.cz>" (falls back to the address). */
export function displayNameOf(value: string): string {
  return value.match(/^\s*"?([^"<]+?)"?\s*</)?.[1]?.trim() || addressOf(value);
}

const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64url");

/** Token = base64url(email).signature — no database row needed, can't be forged without the secret. */
export function createUnsubscribeToken(email: string, secret: string): string {
  const payload = b64url(normalizeEmail(email));
  const sig = createHmac("sha256", secret).update(payload).digest("base64url").slice(0, 32);
  return `${payload}.${sig}`;
}

export function verifyUnsubscribeToken(token: string, secret: string): string | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url").slice(0, 32);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const email = Buffer.from(payload, "base64url").toString("utf8");
  return email.includes("@") ? email : null;
}

/** Ensures the body contains the unsubscribe link (adds a footer when the template has none). */
export function withUnsubscribe(body: string, unsubscribeUrl: string): string {
  if (body.includes(UNSUBSCRIBE_PLACEHOLDER)) return body.split(UNSUBSCRIBE_PLACEHOLDER).join(unsubscribeUrl);
  if (body.includes(unsubscribeUrl)) return body;
  return `${body.trimEnd()}\n\n---\nNechcete dostávat další zprávy? Odhlásit se můžete zde: ${unsubscribeUrl}\n`;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Minimal, safe HTML version of a plain-text email (paragraphs, line breaks, links, optional image). */
export function textToHtml(text: string, opts: { imageUrl?: string | null } = {}): string {
  const paragraphs = text
    .trim()
    .split(/\n{2,}/)
    .map((p) =>
      p === "---"
        ? '<hr style="border:none;border-top:1px solid #ddd;margin:24px 0">'
        : `<p style="margin:0 0 16px">${escapeHtml(p)
            .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#1d4ed8">$1</a>')
            .replace(/\n/g, "<br>")}</p>`,
    )
    .join("\n");
  const image = opts.imageUrl
    ? `<p style="margin:0 0 16px"><img src="${escapeHtml(opts.imageUrl)}" alt="Náhled nového webu" style="max-width:100%;border:1px solid #eee;border-radius:8px"></p>`
    : "";
  return `<!doctype html><html lang="cs"><body style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#111;max-width:640px;margin:0 auto;padding:16px">${paragraphs}${image}</body></html>`;
}

/** Base URL of the app for links in emails (unsubscribe). */
export function appBaseUrl(): string {
  const explicit = process.env.APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  return vercel ? `https://${vercel}` : "http://localhost:3000";
}

export function unsubscribeUrlFor(email: string): string {
  const secret = process.env.UNSUBSCRIBE_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new Error("Chybí UNSUBSCRIBE_SECRET");
  return `${appBaseUrl()}/unsubscribe/${createUnsubscribeToken(email, secret)}`;
}
