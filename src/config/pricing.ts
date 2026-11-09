/**
 * Package calculator ("popcorn" / decoy pricing).
 *
 * The client says how much they would pay per month (the budget). From it we build three packages:
 * - Premium (the target): a bit ABOVE the budget, has everything.
 * - Standard (the decoy): only slightly cheaper than Premium but visibly missing a few features,
 *   so Premium looks like the obvious deal ("only 100 Kč more for all of this").
 * - Základ: clearly cheaper and bare-bones, makes the other two look generous.
 *
 * All amounts are in whole Kč. Change the numbers here; the calculator and its tests read only this file.
 */
export const PRICING_CONFIG = {
  /** Premium target = budget × this, then rounded DOWN to a price ending in 90. Owner's choice: above budget. */
  premiumOverBudget: 1.15,
  /** Gap between Standard and Premium = Premium × this, rounded to whole hundreds, at least `minDecoyGapKc`. */
  decoyGapRatio: 0.1,
  minDecoyGapKc: 100,
  /** Základ = Premium × this, rounded DOWN to a price ending in 90. */
  basicRatio: 0.5,
  /** Základ must stay at least this much below Standard. */
  minBasicGapKc: 200,
  /** Never offer Základ below this (hosting, domain, your time). */
  minBasicKc: 290,
  /** Below this budget the result is shown with a warning. */
  lowBudgetKc: 500,
  /** Above this budget the result is shown with a warning (check the number in the client's reply). */
  highBudgetKc: 20_000,
} as const;

export type PricingConfig = typeof PRICING_CONFIG;
