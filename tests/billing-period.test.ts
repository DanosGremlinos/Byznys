import { describe, expect, it } from "vitest";
import {
  formatPeriodPrice,
  monthlyEquivalent,
  monthlyFromYearly,
  priceForPeriod,
  yearlyOfferText,
  yearlyPrice,
  yearlySaving,
} from "@/lib/billing-period";

describe("yearly billing (2 měsíce zdarma)", () => {
  it("yearly price is 10 monthly payments", () => {
    expect(yearlyPrice(99_000)).toBe(990_000);
    expect(yearlySaving(99_000)).toBe(198_000);
    expect(monthlyFromYearly(990_000)).toBe(99_000);
    expect(priceForPeriod(99_000, "monthly")).toBe(99_000);
    expect(priceForPeriod(99_000, "yearly")).toBe(990_000);
  });
  it("spreads a yearly price over 12 months for MRR", () => {
    expect(monthlyEquivalent(990_000, "yearly")).toBe(82_500);
    expect(monthlyEquivalent(99_000, "monthly")).toBe(99_000);
  });
  it("formats prices with the period", () => {
    expect(formatPeriodPrice(990_000, "yearly").replace(/\s/g, " ")).toBe("9 900 Kč / rok");
    expect(formatPeriodPrice(99_000, "monthly").replace(/\s/g, " ")).toBe("990 Kč / měsíc");
    expect(yearlyOfferText(99_000)).toBe("9 900 Kč ročně (2 měsíce zdarma)");
  });
});
