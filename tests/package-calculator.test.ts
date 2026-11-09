import { describe, expect, it } from "vitest";
import { PRICING_CONFIG } from "@/config/pricing";
import {
  calculatePackages,
  charmAbove,
  charmDown,
  decoyExplanation,
  packageComparisonText,
} from "@/lib/package-calculator";

const templates = [
  { id: "a", name: "Základ", features: ["Hosting a doména", "SSL certifikát"] },
  { id: "b", name: "Standard", features: ["Hosting a doména", "SSL certifikát", "3 úpravy měsíčně"] },
  {
    id: "c",
    name: "Premium",
    features: ["Hosting a doména", "SSL certifikát", "Neomezené úpravy", "Rezervační systém", "Měsíční report"],
  },
];
const prices = (budgetKc: number) => calculatePackages(budgetKc * 100, templates).packages.map((p) => p.priceHalere / 100);

describe("charm prices", () => {
  it("rounds down / up to prices ending in 90", () => {
    expect(charmDown(1150)).toBe(1090);
    expect(charmDown(1090)).toBe(1090);
    expect(charmDown(40)).toBe(90);
    expect(charmAbove(1000)).toBe(1090);
    expect(charmAbove(1090)).toBe(1190);
    expect(charmAbove(589)).toBe(590);
  });
});

describe("calculatePackages (popcorn pricing)", () => {
  it("builds Základ / Standard / Premium from a 1 000 Kč budget", () => {
    expect(prices(1000)).toEqual([490, 990, 1090]);
    expect(prices(1500)).toEqual([790, 1490, 1690]);
    expect(prices(2000)).toEqual([1090, 2090, 2290]);
  });

  it("puts Premium above the budget and keeps the decoy close to it", () => {
    for (const budget of [400, 650, 800, 1000, 1234, 1500, 2500, 5000, 12_000]) {
      const [basic, standard, premium] = prices(budget);
      expect(premium, `premium @ ${budget}`).toBeGreaterThan(budget);
      if (budget >= PRICING_CONFIG.lowBudgetKc)
        expect(premium).toBeLessThanOrEqual(Math.max(budget * PRICING_CONFIG.premiumOverBudget, budget + 100));
      for (const p of [basic, standard, premium]) expect(p % 100, `charm @ ${budget}`).toBe(90);
      // Decoy: small gap to Premium, big gap to Základ.
      expect(premium - standard).toBeLessThan(standard - basic);
      expect(basic).toBeGreaterThanOrEqual(PRICING_CONFIG.minBasicKc);
    }
  });

  it("respects the minimum price of Základ for tiny budgets and warns", () => {
    const r = calculatePackages(30_000, templates);
    const [basic, standard, premium] = r.packages.map((p) => p.priceHalere / 100);
    expect(basic).toBe(PRICING_CONFIG.minBasicKc);
    expect(standard - basic).toBeGreaterThanOrEqual(PRICING_CONFIG.minBasicGapKc);
    expect(premium).toBeGreaterThan(standard);
    expect(r.warnings.join(" ")).toMatch(/velmi nízký/);
  });

  it("recommends only Premium and copies names and features from the templates", () => {
    const r = calculatePackages(100_000, templates);
    expect(r.packages.map((p) => [p.tierId, p.name, p.recommended])).toEqual([
      ["a", "Základ", false],
      ["b", "Standard", false],
      ["c", "Premium", true],
    ]);
    expect(r.packages[2].features).toEqual(templates[2].features);
    expect(r.warnings).toEqual([]);
  });

  it("is deterministic", () => {
    expect(calculatePackages(123_400, templates)).toEqual(calculatePackages(123_400, templates));
  });

  it("warns when Premium barely differs from Standard", () => {
    const flat = [templates[0], templates[1], { ...templates[2], features: [...templates[1].features, "Report"] }];
    expect(calculatePackages(100_000, flat).warnings.join(" ")).toMatch(/méně než 2 funkcemi/);
  });

  it("needs three templates and a positive budget", () => {
    expect(() => calculatePackages(100_000, templates.slice(0, 2))).toThrow(/3 aktivní šablony/);
    expect(() => calculatePackages(0, templates)).toThrow(/kladný rozpočet/);
  });
});

describe("texts", () => {
  const { packages } = calculatePackages(100_000, templates);

  it("explains the decoy", () => {
    expect(decoyExplanation(packages)).toBe(
      "Standard je jen o 100 Kč levnější než Premium, ale chybí mu: Neomezené úpravy, Rezervační systém, Měsíční report.",
    );
  });

  it("marks the recommended package in the email comparison", () => {
    const text = packageComparisonText(packages);
    expect(text).toContain("Základ – 490 Kč měsíčně");
    expect(text).toContain("★ Premium – 1 090 Kč měsíčně (nejoblíbenější)");
    expect(text).toContain("oproti balíčku Standard jen o 100 Kč víc a navíc: Neomezené úpravy");
  });
});
