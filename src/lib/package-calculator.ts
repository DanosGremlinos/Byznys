// Pure package calculator ("popcorn" pricing). Runs in the browser (live preview) and on the server.
import { PRICING_CONFIG, type PricingConfig } from "@/config/pricing";
import { formatCzk } from "@/lib/format";

export type PackageTemplate = { id: string; name: string; features: string[] };

export type OfferedPackage = {
  tierId: string | null;
  name: string;
  priceHalere: number;
  features: string[];
  /** The package we want the client to take (Premium). */
  recommended: boolean;
};

export type PackageCalculation = {
  budgetHalere: number;
  /** Always three: Základ, Standard (decoy), Premium (recommended). */
  packages: OfferedPackage[];
  warnings: string[];
};

/** Largest price ending in 90 that is ≤ kc (e.g. 1150 → 1090). Never below 90. */
export function charmDown(kc: number): number {
  return Math.max(90, Math.floor((kc + 10) / 100) * 100 - 10);
}

/** Smallest price ending in 90 that is > kc (e.g. 1000 → 1090, 1090 → 1190). */
export function charmAbove(kc: number): number {
  return (Math.floor((kc + 10) / 100) + 1) * 100 - 10;
}

const norm = (s: string) => s.trim().toLowerCase();

/** Features of `a` that `b` does not have (case-insensitive). */
export function missingFeatures(a: string[], b: string[]): string[] {
  const has = new Set(b.map(norm));
  return a.filter((f) => !has.has(norm(f)));
}

/**
 * Builds three packages from the client's monthly budget and the first three package templates
 * (sorted: Základ, Standard, Premium). Prices follow PRICING_CONFIG; features come from the templates.
 */
export function calculatePackages(
  budgetHalere: number,
  templates: PackageTemplate[],
  cfg: PricingConfig = PRICING_CONFIG,
): PackageCalculation {
  if (!Number.isFinite(budgetHalere) || budgetHalere <= 0) throw new Error("Zadejte kladný rozpočet v Kč.");
  if (templates.length < 3)
    throw new Error("Kalkulačka potřebuje 3 aktivní šablony balíčků (Základ, Standard, Premium).");
  const [basicT, standardT, premiumT] = templates;
  const budget = budgetHalere / 100;
  const warnings: string[] = [];

  let premium = Math.max(charmDown(budget * cfg.premiumOverBudget), charmAbove(budget));
  const gap = Math.max(cfg.minDecoyGapKc, Math.round((premium * cfg.decoyGapRatio) / 100) * 100);
  let standard = premium - gap;
  const basic = Math.max(
    cfg.minBasicKc,
    Math.min(charmDown(premium * cfg.basicRatio), standard - cfg.minBasicGapKc),
  );
  if (basic > standard - cfg.minBasicGapKc) {
    // Tiny budget: the minimum price for Základ pushes the other two up.
    standard = basic + cfg.minBasicGapKc;
    premium = Math.max(premium, standard + gap);
  }

  if (budget < cfg.lowBudgetKc)
    warnings.push(
      `Rozpočet je velmi nízký – Základ nejde pod ${cfg.minBasicKc} Kč, takže ceny můžou být nad představou klienta.`,
    );
  if (budget > cfg.highBudgetKc) warnings.push("Rozpočet je neobvykle vysoký – zkontrolujte částku z odpovědi.");

  const extras = missingFeatures(premiumT.features, standardT.features);
  if (extras.length < 2)
    warnings.push(
      "Premium se od Standardu liší méně než 2 funkcemi. Návnada funguje nejlépe, když Standardu chybí 2–3 viditelné věci – upravte šablony níže.",
    );

  const pkg = (t: PackageTemplate, kc: number, recommended: boolean): OfferedPackage => ({
    tierId: t.id,
    name: t.name,
    priceHalere: kc * 100,
    features: [...t.features],
    recommended,
  });
  return {
    budgetHalere,
    packages: [pkg(basicT, basic, false), pkg(standardT, standard, false), pkg(premiumT, premium, true)],
    warnings,
  };
}

const kc = (halere: number) => formatCzk(halere).replace(/\s/g, " ");

/** "Standard je jen o 100 Kč levnější než Premium, ale chybí mu: …" (null when it doesn't apply). */
export function decoyExplanation(packages: OfferedPackage[]): string | null {
  const premium = packages.find((p) => p.recommended);
  const decoy = premium ? packages[packages.indexOf(premium) - 1] : undefined;
  if (!premium || !decoy) return null;
  const extras = missingFeatures(premium.features, decoy.features);
  const diff = premium.priceHalere - decoy.priceHalere;
  if (diff <= 0 || !extras.length) return null;
  return `${decoy.name} je jen o ${kc(diff)} levnější než ${premium.name}, ale chybí mu: ${extras.join(", ")}.`;
}

/** Plain-text comparison for the L3 email; the recommended package is marked and its extras spelled out. */
export function packageComparisonText(packages: OfferedPackage[]): string {
  return packages
    .map((p, i) => {
      const head = `${p.recommended ? "★ " : ""}${p.name} – ${kc(p.priceHalere)} měsíčně${p.recommended ? " (nejoblíbenější)" : ""}`;
      const lines = p.features.map((f) => `  • ${f}`);
      const prev = packages[i - 1];
      if (p.recommended && prev && p.priceHalere > prev.priceHalere) {
        const extras = missingFeatures(p.features, prev.features);
        if (extras.length)
          lines.push(`  → oproti balíčku ${prev.name} jen o ${kc(p.priceHalere - prev.priceHalere)} víc a navíc: ${extras.join(", ")}`);
      }
      return [head, ...lines].join("\n");
    })
    .join("\n\n");
}
