import { boolean, index, integer, jsonb, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { websites } from "./clients";
import { createdAt, updatedAt } from "./common";
import { assetSource, builderAssetKind } from "./enums";
import { leadPhotos, leadReviews, leads } from "./leads";
import type { BuilderClientInfo, BuilderStructure, BuilderStyle } from "./types";

export const builderProjects = pgTable(
  "builder_projects",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    leadId: uuid().references(() => leads.id, { onDelete: "set null" }),
    websiteId: uuid().references(() => websites.id, { onDelete: "set null" }),
    clientInfo: jsonb().$type<BuilderClientInfo>().notNull().default({}),
    structure: jsonb()
      .$type<BuilderStructure>()
      .notNull()
      .default({ mode: "one-page", pages: [], sections: [], extras: [] }),
    style: jsonb().$type<BuilderStyle>().notNull().default({}),
    customInstructions: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.leadId), index().on(t.websiteId)],
);

export const builderAssets = pgTable(
  "builder_assets",
  {
    id: uuid().primaryKey().defaultRandom(),
    projectId: uuid()
      .notNull()
      .references(() => builderProjects.id, { onDelete: "cascade" }),
    kind: builderAssetKind().notNull(),
    source: assetSource().notNull(),
    /** Vercel Blob URL (uploads) or original URL (scraped). Null for review assets. */
    url: text(),
    blobPathname: text(),
    filename: text(),
    contentType: text(),
    sortOrder: integer().notNull().default(0),
    isHero: boolean().notNull().default(false),
    isSelected: boolean().notNull().default(true),
    /**
     * The owner confirmed the right to use this asset on the client's live site (the client provided or
     * approved it; for reviews: the reviewer agreed). Unconfirmed assets are only for a non-public demo.
     */
    rightsConfirmed: boolean().notNull().default(false),
    leadPhotoId: uuid().references(() => leadPhotos.id, { onDelete: "set null" }),
    leadReviewId: uuid().references(() => leadReviews.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.projectId, t.sortOrder)],
);

/** Every generated prompt is saved as a new version. */
export const builderPromptVersions = pgTable(
  "builder_prompt_versions",
  {
    id: uuid().primaryKey().defaultRandom(),
    projectId: uuid()
      .notNull()
      .references(() => builderProjects.id, { onDelete: "cascade" }),
    version: integer().notNull(),
    content: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.projectId, t.version)],
);
