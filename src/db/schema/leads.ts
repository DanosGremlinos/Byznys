import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, updatedAt } from "./common";
import { leadStatus } from "./enums";
import { jobs } from "./jobs";
import type { OpeningHours, ScoreFactorResult, ServiceItem, SocialLinks, TechSignals } from "./types";

export const leads = pgTable(
  "leads",
  {
    id: uuid().primaryKey().defaultRandom(),
    /** Google Places place ID; null for manually added leads. */
    placeId: text().unique(),
    searchJobId: uuid().references(() => jobs.id, { onDelete: "set null" }),
    name: text().notNull(),
    category: text(),
    address: text(),
    city: text(),
    lat: doublePrecision(),
    lng: doublePrecision(),
    phone: text(),
    email: text(),
    websiteUrl: text(),
    googleMapsUrl: text(),
    openingHours: jsonb().$type<OpeningHours>(),
    services: jsonb().$type<ServiceItem[]>(),
    socialLinks: jsonb().$type<SocialLinks>(),
    rating: real(),
    reviewCount: integer(),
    logoUrl: text(),
    brandColors: jsonb().$type<string[]>(),
    contactPerson: text(),
    status: leadStatus().notNull().default("new"),
    /** Opportunity score 0–100; null until scored. */
    score: integer(),
    scoreFactors: jsonb().$type<ScoreFactorResult[]>(),
    /** Hash/version of the weights config used, so a score is reproducible. */
    scoreVersion: text(),
    scoredAt: timestamp({ withTimezone: true }),
    notes: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.score), index().on(t.status), index().on(t.city), index().on(t.category)],
);

export const leadPhotos = pgTable(
  "lead_photos",
  {
    id: uuid().primaryKey().defaultRandom(),
    leadId: uuid()
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    url: text().notNull(),
    source: text().notNull(), // "google_places" | "website"
    attribution: text(),
    width: integer(),
    height: integer(),
    sortOrder: integer().notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.leadId)],
);

export const leadReviews = pgTable(
  "lead_reviews",
  {
    id: uuid().primaryKey().defaultRandom(),
    leadId: uuid()
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    author: text().notNull(),
    rating: integer().notNull(),
    text: text().notNull(),
    publishedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.leadId, t.rating)],
);

/** Result of analysing a lead's own website (fetch + PageSpeed Insights). Latest row wins. */
export const leadSiteAnalyses = pgTable(
  "lead_site_analyses",
  {
    id: uuid().primaryKey().defaultRandom(),
    leadId: uuid()
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    url: text().notNull(),
    finalUrl: text(),
    fetchedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    httpStatus: integer(),
    isHttps: boolean(),
    copyrightYear: integer(),
    techSignals: jsonb().$type<TechSignals>(),
    hasTitle: boolean(),
    hasMetaDescription: boolean(),
    hasH1: boolean(),
    hasViewportMeta: boolean(),
    /** PageSpeed Insights performance score 0–100. */
    pagespeedMobile: integer(),
    pagespeedDesktop: integer(),
    /** Heuristic design issues found (e.g. "no responsive images", "inline font tags"). */
    designIssues: jsonb().$type<string[]>(),
    error: text(),
    raw: jsonb().$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.leadId, t.fetchedAt)],
);
