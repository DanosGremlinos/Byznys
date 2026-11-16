// Pure package calculator ("popcorn" pricing) built from the services list. Runs in the browser (live preview) and on the server.
import { PRICING_CONFIG, type PricingConfig } from "@/config/pricing";
import { PACKAGE_NAMES } from "@/config/services";
import { yearlyOfferText } from "@/lib/billing-period";
import { formatCzk } from "@/lib/format";

/** One offered service (from the services list), in calculator order (priority). */
export type ServiceItem = { id: string; name: string; priceHalere: number; required: boolean };

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

/** Nearest price ending in 90 (e.g. 1030 → 990, 1050 → 1090). Never below 90. */
export function charmNearest(kc: number): number {
  return Math.max(90, Math.round((kc + 10) / 100) * 100 - 10);
}

const norm = (s: string) => s.trim().toLowerCase();

/** Features of `a` that `b` does not have (case-insensitive). */
export function missingFeatures(a: string[], b: string[]): string[] {
  const has = new Set(b.map(norm));
  return a.filter((f) => !has.has(norm(f)));
}

const kcOf = (items: ServiceItem[]) => items.reduce((s, x) => s + x.priceHalere, 0) / 100;

/** Adds `candidates` (in order) to `base` while the total stays ≤ capKc; skips ones that don't fit. */
function fill(base: ServiceItem[], candidates: ServiceItem[], capKc: number): ServiceItem[] {
  const out = [...base];
  let sum = kcOf(out);
  for (const c of candidates) {
    if (sum + c.priceHalere / 100 <= capKc) {
      out.push(c);
      sum += c.priceHalere / 100;
    }
  }
  return out;
}

/**
 * Builds Základ / Standard / Premium from the client's monthly budget and the active services (sorted by
 * priority). See PRICING_CONFIG for the rules. Package contents are the service names in priority order.
 */
export function calculatePackages(
  budgetHalere: number,
  services: ServiceItem[],
  cfg: PricingConfig = PRICING_CONFIG,
): PackageCalculation {
  if (!Number.isFinite(budgetHalere) || budgetHalere <= 0) throw new Error("Zadejte kladný rozpočet v Kč.");
  if (!services.length) throw new Error("Kalkulačka potřebuje seznam služeb – přidejte je dole na stránce.");
  const budget = budgetHalere / 100;
  const warnings: string[] = [];
  const order = new Map(services.map((s, i) => [s.id, i]));
  const sorted = (items: ServiceItem[]) => [...items].sort((a, b) => order.get(a.id)! - order.get(b.id)!);

  const required = services.filter((s) => s.required);
  const optional = services.filter((s) => !s.required);

  const premiumSet = fill(required, optional, budget * cfg.premiumOverBudget);
  const premiumOptional = premiumSet.filter((s) => !s.required);
  const basicSet = fill(required, premiumOptional, budget * cfg.basicBudgetRatio);
  const basicIds = new Set(basicSet.map((s) => s.id));
  // Decoy: Premium without its cheapest extras (extras = what Základ doesn't have). Keep at least one extra.
  const extras = premiumOptional.filter((s) => !basicIds.has(s.id));
  const removeCount = Math.min(cfg.decoyRemoveCount, Math.max(0, extras.length - 1));
  const removed = new Set(
    [...extras]
      .sort((a, b) => a.priceHalere - b.priceHalere || order.get(b.id)! - order.get(a.id)!)
      .slice(0, removeCount)
      .map((s) => s.id),
  );
  const standardSet = premiumSet.filter((s) => !removed.has(s.id));

  const basic = charmNearest(kcOf(basicSet));
  let standard = charmNearest(kcOf(standardSet));
  let premium = charmNearest(kcOf(premiumSet));
  // Rounding must never make a bigger package cheaper or equal.
  if (standard <= basic) standard = basic + 100;
  if (premium <= standard) premium = standard + 100;

  if (kcOf(required) > budget * cfg.premiumOverBudget)
    warnings.push("Povinné služby samy stojí víc než rozpočet klienta – všechny balíčky budou nad jeho představou.");
  if (premiumSet.length === services.length && kcOf(premiumSet) < budget)
    warnings.push("Do rozpočtu se vejdou všechny služby – Premium obsahuje vše a je levnější než rozpočet.");
  if (extras.length < 2)
    warnings.push(
      "Premium se od ostatních balíčků liší málo – přidejte další služby nebo upravte ceny, aby návnada fungovala.",
    );
  if (services.some((s) => s.priceHalere <= 0))
    warnings.push("Některé služby nemají cenu – doplňte ji v seznamu služeb, jinak budou balíčky příliš levné.");
  if (budget < cfg.lowBudgetKc)
    warnings.push("Rozpočet je velmi nízký – balíčky můžou vyjít nad představou klienta.");
  if (budget > cfg.highBudgetKc) warnings.push("Rozpočet je neobvykle vysoký – zkontrolujte částku z odpovědi.");

  const pkg = (i: 0 | 1 | 2, items: ServiceItem[], kc: number): OfferedPackage => ({
    tierId: null,
    name: PACKAGE_NAMES[i],
    priceHalere: kc * 100,
    features: sorted(items).map((s) => s.name),
    recommended: i === 2,
  });
  return {
    budgetHalere,
    packages: [pkg(0, basicSet, basic), pkg(1, standardSet, standard), pkg(2, premiumSet, premium)],
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
      const head = `${p.recommended ? "★ " : ""}${p.name} – ${kc(p.priceHalere)} měsíčně, nebo ${yearlyOfferText(p.priceHalere)}${p.recommended ? " – nejoblíbenější" : ""}`;
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
