// JSON column shapes shared by the schema, seed and application code.

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

/** Opening hours per weekday; an empty array means closed. Times are "HH:MM" in Europe/Prague. */
export type OpeningHours = Partial<Record<Weekday, { open: string; close: string }[]>>;

/** One item of a service list / menu / price list found on the lead's site. */
export type ServiceItem = {
  name: string;
  description?: string;
  /** Price in haléře, if known. */
  priceHalere?: number;
  /** Free-form price text when it is not a single number (e.g. "od 350 Kč"). */
  priceText?: string;
  category?: string;
};

export type SocialLinks = Partial<
  Record<"facebook" | "instagram" | "tiktok" | "youtube" | "linkedin" | "x", string>
>;

/** Result of one opportunity-score factor, stored on the lead so it is visible and reproducible. */
export type ScoreFactorResult = {
  key: string;
  fired: boolean;
  /** Configured weight at the time of scoring. */
  weight: number;
  /** Points contributed (0 when not fired). */
  points: number;
  /** Human-readable reason, Czech, e.g. "Copyright 2014". */
  detail?: string;
};

export type TechSignals = {
  generator?: string;
  usesJquery?: boolean;
  jqueryVersion?: string;
  usesFlash?: boolean;
  tableLayout?: boolean;
  framesetOrIframes?: boolean;
  cms?: string;
};

export type JobProgress = { done: number; total: number; message?: string };

/** Builder: client info form (prefilled from lead / client, editable). */
export type BuilderClientInfo = {
  businessName?: string;
  category?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  openingHours?: OpeningHours;
  services?: ServiceItem[];
  socialLinks?: SocialLinks;
  currentWebsite?: string;
  domain?: string;
  notes?: string;
};

export type BuilderStructure = {
  mode: "one-page" | "multi-page";
  pages: string[];
  sections: string[];
  extras: string[];
};

export type BuilderStyle = {
  template?: "industrial" | "economy" | "premium" | "business" | "vip";
  palette?: string[];
  paletteSource?: "logo" | "manual";
  fonts?: { heading?: string; body?: string };
  mood?: string[];
  referenceUrls?: string[];
};
