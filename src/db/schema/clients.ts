import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createdAt, updatedAt } from "./common";
import { websiteStatus } from "./enums";
import { leads } from "./leads";

export const clients = pgTable(
  "clients",
  {
    id: uuid().primaryKey().defaultRandom(),
    businessName: text().notNull(),
    /** IČO */
    ico: text(),
    /** DIČ */
    dic: text(),
    contactPerson: text(),
    email: text(),
    phone: text(),
    address: text(),
    city: text(),
    notes: text(),
    /** Lead this client was converted from, if any. */
    leadId: uuid().references(() => leads.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.leadId)],
);

export const websites = pgTable(
  "websites",
  {
    id: uuid().primaryKey().defaultRandom(),
    clientId: uuid()
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    name: text().notNull(),
    domain: text(),
    status: websiteStatus().notNull().default("draft"),
    liveUrl: text(),
    previewUrl: text(),
    screenshotUrl: text(),
    launchedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.clientId), index().on(t.status)],
);
