export type RevenuePoint = { period: string; amountHalere: number };

/** Last 12 calendar months (Prague) including the current one, missing months as 0. */
export function fillMonths(rows: { period: string; amount: number | null }[], now: Date): RevenuePoint[] {
  const byPeriod = new Map(rows.map((r) => [r.period, r.amount ?? 0]));
  const [y, m] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
  })
    .format(now)
    .split("-")
    .map(Number);
  const out: RevenuePoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const period = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    out.push({ period, amountHalere: byPeriod.get(period) ?? 0 });
  }
  return out;
}
