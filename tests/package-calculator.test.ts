import { describe, expect, it } from "vitest";
import { PRICING_CONFIG } from "@/config/pricing";
import { DEFAULT_SERVICES } from "@/config/services";
import {
  calculatePackages,
  charmAbove,
  charmDown,
  charmNearest,
  decoyExplanation,
  packageComparisonText,
  type ServiceItem,
} from "@/lib/package-calculator";

const services: ServiceItem[] = DEFAULT_SERVICES.map((s, i) => ({
  id: `s${i}`,
  name: s.name,
  priceHalere: s.priceKc * 100,
  required: s.required ?? false,
}));
const calc = (budgetKc: number, list = services) => calculatePackages(budgetKc * 100, list);

describe("charm prices", () => {
  it("rounds to prices ending in 90", () => {
    expect(charmDown(1150)).toBe(1090);
    expect(charmDown(40)).toBe(90);
    expect(charmAbove(1000)).toBe(1090);
    expect(charmNearest(1030)).toBe(990);
    expect(charmNearest(1050)).toBe(1090);
    expect(charmNearest(500)).toBe(490);
    expect(charmNearest(20)).toBe(90);
  });
});

describe("calculatePackages from services", () => {
  it("composes the packages for a 1 000 Kč budget", () => {
    const r = calc(1000);
    expect(r.packages.map((p) => p.priceHalere / 100)).toEqual([490, 990, 1190]);
    const [basic, standard, premium] = r.packages;
    // Základ: required services + what fits into half of the budget.
    expect(basic.features).toEqual([
      "Hosting a doména",
      "SSL certifikát a zabezpečení",
      "Zálohy webu",
      "Drobné úpravy obsahu (2× měsíčně)",
    ]);
    // Standard = Premium without its two cheapest extras.
    expect(premium.features.filter((f) => !standard.features.includes(f))).toEqual([
      "Kontaktní formulář",
      "Měsíční report návštěvnosti",
    ]);
    expect(premium.features).toContain("Rezervační systém");
    expect(premium.features).not.toContain("Vícejazyčná verze");
    expect(r.packages.map((p) => [p.name, p.recommended])).toEqual([
      ["Základ", false],
      ["Standard", false],
      ["Premium", true],
    ]);
    expect(r.warnings).toEqual([]);
  });

  it("keeps the popcorn shape for many budgets", () => {
    const requiredNames = services.filter((s) => s.required).map((s) => s.name);
    for (const budget of [600, 800, 1000, 1234, 1500, 2000]) {
      const r = calc(budget);
      const [basic, standard, premium] = r.packages;
      const [pb, ps, pp] = r.packages.map((p) => p.priceHalere / 100);
      expect(pb < ps && ps < pp, `order @ ${budget}`).toBe(true);
      for (const p of [pb, ps, pp]) expect(p % 100, `charm @ ${budget}`).toBe(90);
      // Each bigger package contains the smaller one, and all contain the required services.
      expect(basic.features.every((f) => standard.features.includes(f))).toBe(true);
      expect(standard.features.every((f) => premium.features.includes(f))).toBe(true);
      for (const f of requiredNames) expect(basic.features).toContain(f);
      // Premium's services fit under budget × premiumOverBudget (before rounding to …90).
      const premiumSum = services
        .filter((s) => premium.features.includes(s.name))
        .reduce((s, x) => s + x.priceHalere / 100, 0);
      expect(premiumSum).toBeLessThanOrEqual(budget * PRICING_CONFIG.premiumOverBudget);
    }
  });

  it("warns when everything fits or prices are missing", () => {
    expect(calc(5000).warnings.join(" ")).toMatch(/vejdou všechny služby/);
    const free = services.map((s, i) => (i === 4 ? { ...s, priceHalere: 0 } : s));
    expect(calc(1000, free).warnings.join(" ")).toMatch(/nemají cenu/);
    expect(calc(200).warnings.join(" ")).toMatch(/Povinné služby/);
  });

  it("is deterministic and validates input", () => {
    expect(calc(1234)).toEqual(calc(1234));
    expect(() => calc(0)).toThrow(/kladný rozpočet/);
    expect(() => calc(1000, [])).toThrow(/seznam služeb/);
  });
});

describe("texts", () => {
  const { packages } = calc(1000);

  it("explains the decoy", () => {
    expect(decoyExplanation(packages)).toBe(
      "Standard je jen o 200 Kč levnější než Premium, ale chybí mu: Kontaktní formulář, Měsíční report návštěvnosti.",
    );
  });

  it("marks the recommended package in the email comparison", () => {
    const text = packageComparisonText(packages);
    expect(text).toContain("Základ – 490 Kč měsíčně, nebo 4 900 Kč ročně (2 měsíce zdarma)");
    expect(text).toContain("★ Premium – 1 190 Kč měsíčně, nebo 11 900 Kč ročně (2 měsíce zdarma) – nejoblíbenější");
    expect(text).toContain("oproti balíčku Standard jen o 200 Kč víc a navíc: Kontaktní formulář");
  });
});
