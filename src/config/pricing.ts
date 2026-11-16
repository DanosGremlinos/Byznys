/**
 * Package calculator ("popcorn" / decoy pricing) built from the list of services (Balíčky → Služby).
 *
 * The client says how much they would pay per month (the budget). From the services we build three packages:
 * - Premium (the target): required services + optional ones by priority, up to budget × premiumOverBudget,
 *   so it ends up a bit ABOVE the budget.
 * - Standard (the decoy): Premium without its `decoyRemoveCount` cheapest extras – only slightly cheaper,
 *   but visibly missing a few things, so Premium looks like the obvious deal.
 * - Základ: required services + optional ones up to budget × basicBudgetRatio; clearly cheaper and bare-bones.
 * A package costs the sum of its services, rounded to the nearest price ending in 90 Kč.
 *
 * All amounts are in whole Kč. Change the numbers here; the calculator and its tests read only this file.
 */
export const PRICING_CONFIG = {
  /** Premium may cost up to budget × this. Owner's choice: above budget. */
  premiumOverBudget: 1.15,
  /** Základ takes services up to budget × this. */
  basicBudgetRatio: 0.5,
  /** How many of Premium's cheapest extras Standard lacks. */
  decoyRemoveCount: 2,
  /** Below this budget the result is shown with a warning. */
  lowBudgetKc: 500,
  /** Above this budget the result is shown with a warning (check the number in the client's reply). */
  highBudgetKc: 20_000,
} as const;

export type PricingConfig = typeof PRICING_CONFIG;

/**
 * Yearly subscription: the client pays for `yearlyPaidMonths` months and gets 12 ("2 měsíce zdarma").
 * Owner's choice. The yearly price of a package = monthly price × this.
 */
export const YEARLY_PAID_MONTHS = 10;
