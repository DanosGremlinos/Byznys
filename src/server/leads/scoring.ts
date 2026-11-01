// Transparent, reproducible opportunity score. Pure function: the same inputs and config
// always give the same result (the reference year comes from the analysis date, not "now").
import { createHash } from "node:crypto";
import { SCORING_CONFIG, type ScoreFactorKey } from "@/config/scoring";
import type { ScoreFactorResult, TechSignals } from "@/db/schema/types";

export const SCORING_VERSION = createHash("sha256")
  .update(JSON.stringify(SCORING_CONFIG))
  .digest("hex")
  .slice(0, 10);

export type ScoreInput = {
  websiteUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  analysis: {
    fetchedAt: Date;
    httpStatus: number | null;
    isHttps: boolean | null;
    copyrightYear: number | null;
    techSignals: TechSignals | null;
    hasTitle: boolean | null;
    hasMetaDescription: boolean | null;
    hasH1: boolean | null;
    hasViewportMeta: boolean | null;
    pagespeedMobile: number | null;
    designIssues: string[] | null;
    error: string | null;
  } | null;
};

export type ScoreResult = { score: number; factors: ScoreFactorResult[]; version: string };

const { weights: W, thresholds: T } = SCORING_CONFIG;

function factor(key: ScoreFactorKey, fired: boolean, detail?: string): ScoreFactorResult {
  return { key, fired, weight: W[key], points: fired ? W[key] : 0, ...(detail ? { detail } : {}) };
}

function outdatedReasons(a: NonNullable<ScoreInput["analysis"]>): string[] {
  const reasons: string[] = [];
  const refYear = a.fetchedAt.getUTCFullYear();
  if (a.copyrightYear && a.copyrightYear < refYear - T.outdatedCopyrightYears) {
    reasons.push(`copyright ${a.copyrightYear}`);
  }
  const t = a.techSignals ?? {};
  const gen = t.generator?.toLowerCase();
  if (gen && T.oldGenerators.some((g) => gen.startsWith(g))) reasons.push(`starý systém (${t.generator})`);
  if (t.jqueryVersion) {
    const [maj, min] = t.jqueryVersion.split(".").map(Number);
    if (Number.isFinite(maj) && maj + (min || 0) / 10 < T.oldJqueryBelow)
      reasons.push(`jQuery ${t.jqueryVersion}`);
  }
  if (t.usesFlash) reasons.push("Flash");
  if (t.tableLayout) reasons.push("rozvržení tabulkami");
  if (t.framesetOrIframes) reasons.push("rámy (frameset)");
  return reasons;
}

export function computeScore(input: ScoreInput): ScoreResult {
  const a = input.analysis;
  const hasWebsite = Boolean(input.websiteUrl);
  // A site that could not be loaded at all counts as "no working website".
  const siteBroken = hasWebsite && a !== null && (a.error !== null || (a.httpStatus ?? 0) >= 400);
  const noWebsite = !hasWebsite || siteBroken;

  const factors: ScoreFactorResult[] = [];
  factors.push(
    factor(
      "noWebsite",
      noWebsite,
      !hasWebsite ? "Na Google Maps není uveden web" : siteBroken ? "Web se nepodařilo načíst" : undefined,
    ),
  );

  const siteFactors: ScoreFactorResult[] = [];
  if (!noWebsite && a) {
    const outdated = outdatedReasons(a);
    siteFactors.push(factor("outdatedSite", outdated.length > 0, outdated.join(", ") || undefined));

    const issues = a.designIssues ?? [];
    siteFactors.push(
      factor(
        "poorDesign",
        issues.length >= T.poorDesignMinIssues,
        issues.length ? issues.join(", ") : undefined,
      ),
    );
    siteFactors.push(
      factor(
        "notMobileFriendly",
        a.hasViewportMeta === false,
        a.hasViewportMeta === false ? "Chybí viewport meta tag" : undefined,
      ),
    );
    const ps = a.pagespeedMobile;
    siteFactors.push(
      factor(
        "slow",
        ps !== null && ps < T.slowPagespeedBelow,
        ps !== null ? `PageSpeed mobil ${ps}/100` : undefined,
      ),
    );
    siteFactors.push(
      factor("noHttps", a.isHttps === false, a.isHttps === false ? "Web běží na http://" : undefined),
    );
    const missing = [
      a.hasTitle === false && "title",
      a.hasMetaDescription === false && "meta description",
      a.hasH1 === false && "h1",
    ].filter(Boolean) as string[];
    siteFactors.push(
      factor("missingSeo", missing.length > 0, missing.length ? `Chybí: ${missing.join(", ")}` : undefined),
    );
  } else {
    // Not applicable without a working site; listed as not fired so every factor is always visible.
    for (const key of [
      "outdatedSite",
      "poorDesign",
      "notMobileFriendly",
      "slow",
      "noHttps",
      "missingSeo",
    ] as const) {
      siteFactors.push(
        factor(key, false, noWebsite ? "Nelze hodnotit bez webu" : "Web zatím nebyl analyzován"),
      );
    }
  }
  factors.push(...siteFactors);

  const sitePoints = siteFactors.reduce((sum, f) => sum + f.points, 0);
  const weakWeb = noWebsite || sitePoints >= T.weakWebMinPoints;
  const strong = (input.rating ?? 0) >= T.strongRating && (input.reviewCount ?? 0) >= T.strongReviewCount;
  factors.push(
    factor(
      "strongReputationWeakWeb",
      strong && weakWeb,
      input.rating !== null
        ? `Hodnocení ${input.rating.toLocaleString("cs-CZ")} (${input.reviewCount ?? 0} recenzí)`
        : undefined,
    ),
  );

  const total = factors.reduce((sum, f) => sum + f.points, 0);
  return { score: Math.min(100, total), factors, version: SCORING_VERSION };
}
