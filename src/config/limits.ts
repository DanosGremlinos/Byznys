/**
 * Spending guards for paid Google APIs. Every lead search costs up to 3 Places Text Search requests
 * plus up to 4 photo requests per found business (max. 60 businesses → 240 photo requests).
 * Override with the env var LEAD_SEARCH_DAILY_LIMIT (0 = searching disabled).
 */
export const LEAD_SEARCH_DAILY_LIMIT_DEFAULT = 5;

export function leadSearchDailyLimit(): number {
  const raw = process.env.LEAD_SEARCH_DAILY_LIMIT;
  const n = raw === undefined || raw === "" ? NaN : Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : LEAD_SEARCH_DAILY_LIMIT_DEFAULT;
}
