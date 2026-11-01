import { describe, expect, it } from "vitest";
import { SCORING_CONFIG } from "@/config/scoring";
import { computeScore, SCORING_VERSION, type ScoreInput } from "@/server/leads/scoring";

const W = SCORING_CONFIG.weights;

const modernSite: NonNullable<ScoreInput["analysis"]> = {
  fetchedAt: new Date("2026-10-01T10:00:00Z"),
  httpStatus: 200,
  isHttps: true,
  copyrightYear: 2026,
  techSignals: { generator: "WordPress 6.6" },
  hasTitle: true,
  hasMetaDescription: true,
  hasH1: true,
  hasViewportMeta: true,
  pagespeedMobile: 88,
  designIssues: [],
  error: null,
};

const fired = (r: ReturnType<typeof computeScore>) =>
  r.factors
    .filter((f) => f.fired)
    .map((f) => f.key)
    .sort();

describe("opportunity score", () => {
  it("scores a lead without a website (plus strong reputation)", () => {
    const r = computeScore({ websiteUrl: null, rating: 4.7, reviewCount: 320, analysis: null });
    expect(fired(r)).toEqual(["noWebsite", "strongReputationWeakWeb"]);
    expect(r.score).toBe(W.noWebsite + W.strongReputationWeakWeb);
  });

  it("gives a modern, fast site a zero score", () => {
    const r = computeScore({
      websiteUrl: "https://x.cz",
      rating: 4.9,
      reviewCount: 500,
      analysis: modernSite,
    });
    expect(r.score).toBe(0);
    expect(fired(r)).toEqual([]);
  });

  it("fires every site factor for an old, slow, insecure site and caps at 100", () => {
    const r = computeScore({
      websiteUrl: "http://x.cz",
      rating: 4.8,
      reviewCount: 200,
      analysis: {
        ...modernSite,
        isHttps: false,
        copyrightYear: 2014,
        techSignals: { generator: "Joomla! 1.5", jqueryVersion: "1.4.2", tableLayout: true },
        hasMetaDescription: false,
        hasH1: false,
        hasViewportMeta: false,
        pagespeedMobile: 23,
        designIssues: ["a", "b", "c"],
      },
    });
    expect(fired(r)).toEqual(
      [
        "missingSeo",
        "noHttps",
        "notMobileFriendly",
        "outdatedSite",
        "poorDesign",
        "slow",
        "strongReputationWeakWeb",
      ].sort(),
    );
    const sum =
      W.outdatedSite +
      W.poorDesign +
      W.notMobileFriendly +
      W.slow +
      W.noHttps +
      W.missingSeo +
      W.strongReputationWeakWeb;
    expect(r.score).toBe(Math.min(100, sum));
    expect(r.factors.find((f) => f.key === "outdatedSite")?.detail).toContain("copyright 2014");
    expect(r.factors.find((f) => f.key === "slow")?.detail).toBe("PageSpeed mobil 23/100");
  });

  it("treats an unreachable website as no website", () => {
    const r = computeScore({
      websiteUrl: "https://x.cz",
      rating: null,
      reviewCount: null,
      analysis: { ...modernSite, error: "timeout" },
    });
    expect(fired(r)).toEqual(["noWebsite"]);
  });

  it("uses the analysis year (not today) for the copyright rule, so it is reproducible", () => {
    const a = { ...modernSite, copyrightYear: 2022 };
    expect(
      fired(computeScore({ websiteUrl: "https://x.cz", rating: null, reviewCount: null, analysis: a })),
    ).toContain("outdatedSite");
    const older = { ...a, fetchedAt: new Date("2024-06-01T00:00:00Z") };
    expect(
      fired(computeScore({ websiteUrl: "https://x.cz", rating: null, reviewCount: null, analysis: older })),
    ).not.toContain("outdatedSite");
  });

  it("always lists every factor with its weight and is deterministic", () => {
    const input: ScoreInput = { websiteUrl: null, rating: 3, reviewCount: 2, analysis: null };
    const a = computeScore(input);
    const b = computeScore(input);
    expect(a).toEqual(b);
    expect(a.factors.map((f) => f.key).sort()).toEqual(Object.keys(W).sort());
    for (const f of a.factors) expect(f.weight).toBe(W[f.key as keyof typeof W]);
    expect(a.version).toBe(SCORING_VERSION);
    expect(SCORING_VERSION).toMatch(/^[0-9a-f]{10}$/);
  });
});
