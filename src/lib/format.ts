// Formatting helpers for the Czech UI: CZK currency, Czech dates, Europe/Prague timezone.

export const TIME_ZONE = "Europe/Prague";
export const LOCALE = "cs-CZ";

const czkFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "CZK",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "numeric",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Formats an amount stored in haléře, e.g. 99000 → "990 Kč". */
export function formatCzk(halere: number): string {
  return czkFormatter.format(halere / 100);
}

/** Converts whole crowns to haléře. */
export function czkToHalere(czk: number): number {
  return Math.round(czk * 100);
}

/**
 * Formats a date as d. M. yyyy in Europe/Prague, e.g. "1. 11. 2026".
 * Accepts a Date, an ISO timestamp, or a calendar date string "yyyy-mm-dd"
 * (calendar dates are shown as-is, without timezone shifting).
 */
export function formatDate(value: Date | string): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return `${d}. ${m}. ${y}`;
  }
  return normalize(dateFormatter.format(toDate(value)));
}

/** Formats as "d. M. yyyy HH:mm" in Europe/Prague. */
export function formatDateTime(value: Date | string): string {
  return normalize(dateTimeFormatter.format(toDate(value)));
}

/** Today's calendar date in Europe/Prague as "yyyy-mm-dd". */
export function pragueToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts; // en-CA yields yyyy-mm-dd
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

// Intl may use narrow no-break spaces; normalize to plain spaces for consistency.
function normalize(s: string): string {
  return s.replace(/[  ]/g, " ");
}
