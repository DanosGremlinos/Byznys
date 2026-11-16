// Monthly vs yearly subscriptions. A subscription stores its price per billing period; these helpers
// convert between periods and format prices with the right unit.
import { YEARLY_PAID_MONTHS } from "@/config/pricing";
import { formatCzk } from "./format";

export type BillingPeriod = "monthly" | "yearly";

export const BILLING_PERIODS: BillingPeriod[] = ["monthly", "yearly"];

/** Months covered by one payment. */
export const PERIOD_MONTHS: Record<BillingPeriod, number> = { monthly: 1, yearly: 12 };

export const PERIOD_LABELS: Record<BillingPeriod, string> = { monthly: "Měsíčně", yearly: "Ročně" };

/** Short unit for tight places: "měs." / "rok". */
export const PERIOD_SHORT: Record<BillingPeriod, string> = { monthly: "měs.", yearly: "rok" };

/** Unit after a price: "měsíc" / "rok". */
export const PERIOD_UNIT: Record<BillingPeriod, string> = { monthly: "měsíc", yearly: "rok" };

/** Yearly price for a monthly price ("2 měsíce zdarma": monthly × 10). */
export function yearlyPrice(monthlyHalere: number): number {
  return monthlyHalere * YEARLY_PAID_MONTHS;
}

/** Monthly price that a yearly price was derived from (inverse of yearlyPrice). */
export function monthlyFromYearly(yearlyHalere: number): number {
  return Math.round(yearlyHalere / YEARLY_PAID_MONTHS);
}

/** Price per period derived from a monthly template price. */
export function priceForPeriod(monthlyHalere: number, period: BillingPeriod): number {
  return period === "yearly" ? yearlyPrice(monthlyHalere) : monthlyHalere;
}

/** What the subscription is worth per month (for MRR and sorting). Yearly is spread over 12 months. */
export function monthlyEquivalent(priceHalere: number, period: BillingPeriod): number {
  return period === "yearly" ? Math.round(priceHalere / 12) : priceHalere;
}

/** Saving of the yearly payment against 12 monthly payments. */
export function yearlySaving(monthlyHalere: number): number {
  return monthlyHalere * 12 - yearlyPrice(monthlyHalere);
}

/** "990 Kč / měsíc", "9 900 Kč / rok". */
export function formatPeriodPrice(priceHalere: number, period: BillingPeriod): string {
  return `${formatCzk(priceHalere)} / ${PERIOD_UNIT[period]}`;
}

/** "2 měsíce zdarma" – the yearly bonus in words. */
export function yearlyBonusText(): string {
  const free = 12 - YEARLY_PAID_MONTHS;
  return free === 1 ? "1 měsíc zdarma" : free <= 4 ? `${free} měsíce zdarma` : `${free} měsíců zdarma`;
}

/** Customer-facing yearly line for emails, e.g. "9 900 Kč ročně (2 měsíce zdarma)". */
export function yearlyOfferText(monthlyHalere: number): string {
  return `${formatCzk(yearlyPrice(monthlyHalere)).replace(/\s/g, " ")} ročně (${yearlyBonusText()})`;
}
