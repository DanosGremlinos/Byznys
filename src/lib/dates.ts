// Calendar-date helpers on "yyyy-mm-dd" strings (no time zones involved).

function parts(date: string): [number, number, number] {
  const [y, m, d] = date.split("-").map(Number);
  return [y, m, d];
}

const fmt = (dt: Date) => dt.toISOString().slice(0, 10);

export function addDays(date: string, days: number): string {
  const [y, m, d] = parts(date);
  return fmt(new Date(Date.UTC(y, m - 1, d + days)));
}

/** Adds months, clamping to the last day of the target month (31. 1. + 1 month → 28./29. 2.). */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = parts(date);
  const lastDay = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  return fmt(new Date(Date.UTC(y, m - 1 + months, Math.min(d, lastDay))));
}

/** Whole days from a to b (b − a). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = parts(a);
  const [by, bm, bd] = parts(b);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/**
 * New "paid until" after paying `months` whole periods. Periods start the day after the current
 * paid-until date: paid until 31. 1. + 1 month → paid until 28. 2.; paid until 14. 3. → 14. 4.
 */
export function extendPaidUntil(paidUntil: string, months: number): string {
  return addDays(addMonths(addDays(paidUntil, 1), months), -1);
}

/** Days overdue: 0 when paid_until is today or later; 1 the first unpaid day, and so on. */
export function daysOverdue(paidUntil: string, today: string): number {
  return Math.max(0, daysBetween(paidUntil, today));
}
