// Opportunity score configuration — the ONLY place where weights and thresholds live.
// Score = sum of the weights of the factors that fired, capped at 100.
// Changing anything here changes `SCORING_VERSION`, so stored scores show which config produced them.

export const SCORING_CONFIG = {
  weights: {
    /** The business has no website at all. */
    noWebsite: 60,
    /** Old copyright year or old technology (old CMS, old jQuery, Flash, table layout). */
    outdatedSite: 15,
    /** Heuristic design problems found on the page. */
    poorDesign: 10,
    /** No viewport meta tag (not mobile-friendly). */
    notMobileFriendly: 15,
    /** Low PageSpeed Insights mobile performance score. */
    slow: 10,
    /** Site is served without HTTPS. */
    noHttps: 5,
    /** Missing <title>, meta description or <h1>. */
    missingSeo: 10,
    /** Highly rated, many reviews, but the web presence is weak. */
    strongReputationWeakWeb: 25,
  },
  thresholds: {
    /** Copyright year older than (analysis year − this) counts as outdated. */
    outdatedCopyrightYears: 3,
    /** Generator versions considered old (prefix match, case-insensitive). */
    oldGenerators: ["joomla! 1.", "joomla! 2.", "wordpress 3.", "wordpress 4.", "drupal 6", "drupal 7"],
    /** jQuery major.minor below this counts as old technology. */
    oldJqueryBelow: 1.9,
    /** Design issues needed to fire `poorDesign`. */
    poorDesignMinIssues: 2,
    /** PageSpeed mobile performance below this fires `slow`. */
    slowPagespeedBelow: 50,
    /** Rating and review count needed for `strongReputationWeakWeb`. */
    strongRating: 4.3,
    strongReviewCount: 50,
    /** Site-quality points (sum of the other web factors) that count as a "weak web presence". */
    weakWebMinPoints: 25,
  },
} as const;

export type ScoreFactorKey = keyof typeof SCORING_CONFIG.weights;

/** Czech labels shown in the UI for each factor. */
export const SCORE_FACTOR_LABELS: Record<ScoreFactorKey, string> = {
  noWebsite: "Nemá web",
  outdatedSite: "Zastaralý web",
  poorDesign: "Slabý design",
  notMobileFriendly: "Není pro mobily",
  slow: "Pomalý web",
  noHttps: "Bez HTTPS",
  missingSeo: "Chybí základní SEO",
  strongReputationWeakWeb: "Skvělé hodnocení, slabý web",
};
