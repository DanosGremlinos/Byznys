import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { clients, websites } from "./clients";
import { createdAt, updatedAt } from "./common";
import {
  dunningRunStatus,
  dunningStepStatus,
  invoiceStatus,
  subscriptionEventType,
  subscriptionStatus,
} from "./enums";
import { emails } from "./messaging";

// Payments are collected outside the app (handled personally). The app only tracks
// what is due, records payments manually and runs the reminder (dunning) sequence.

export const subscriptionTiers = pgTable("subscription_tiers", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull().unique(),
  description: text(),
  monthlyPriceHalere: integer().notNull(),
  features: jsonb().$type<string[]>().notNull().default([]),
  isActive: boolean().notNull().default(true),
  sortOrder: integer().notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid().primaryKey().defaultRandom(),
    clientId: uuid()
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    /** One subscription per website. */
    websiteId: uuid()
      .notNull()
      .unique()
      .references(() => websites.id, { onDelete: "restrict" }),
    tierId: uuid()
      .notNull()
      .references(() => subscriptionTiers.id, { onDelete: "restrict" }),
    status: subscriptionStatus().notNull().default("active"),
    /** Monthly price agreed with the client (may differ from the tier list price). */
    priceHalere: integer().notNull(),
    startedOn: date({ mode: "string" }).notNull(),
    nextBillingDate: date({ mode: "string" }),
    cancelledAt: timestamp({ withTimezone: true }),
    cancelReason: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.clientId), index().on(t.status, t.nextBillingDate)],
);

/** History of sales and subscription changes (feeds the dashboard timeline). */
export const subscriptionEvents = pgTable(
  "subscription_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    subscriptionId: uuid()
      .notNull()
      .references(() => subscriptions.id, { onDelete: "cascade" }),
    clientId: uuid()
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    type: subscriptionEventType().notNull(),
    fromTierId: uuid().references(() => subscriptionTiers.id, { onDelete: "set null" }),
    toTierId: uuid().references(() => subscriptionTiers.id, { onDelete: "set null" }),
    fromPriceHalere: integer(),
    toPriceHalere: integer(),
    amountHalere: integer(),
    note: text(),
    occurredAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.occurredAt), index().on(t.subscriptionId)],
);

/**
 * A payment request for one billing period. "Overdue" is derived:
 * status = 'issued' and due_date < today (Europe/Prague).
 */
export const invoices = pgTable(
  "invoices",
  {
    id: uuid().primaryKey().defaultRandom(),
    number: text().notNull().unique(),
    subscriptionId: uuid()
      .notNull()
      .references(() => subscriptions.id, { onDelete: "restrict" }),
    clientId: uuid()
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    amountHalere: integer().notNull(),
    periodStart: date({ mode: "string" }).notNull(),
    periodEnd: date({ mode: "string" }).notNull(),
    issuedOn: date({ mode: "string" }).notNull(),
    dueDate: date({ mode: "string" }).notNull(),
    /** Variabilní symbol for bank transfer. */
    variableSymbol: text().notNull(),
    status: invoiceStatus().notNull().default("issued"),
    /** Recorded manually when the payment arrives. */
    paidAt: timestamp({ withTimezone: true }),
    paidAmountHalere: integer(),
    note: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.status, t.dueDate), index().on(t.clientId), index().on(t.subscriptionId)],
);

export const dunningRuns = pgTable(
  "dunning_runs",
  {
    id: uuid().primaryKey().defaultRandom(),
    invoiceId: uuid()
      .notNull()
      .unique()
      .references(() => invoices.id, { onDelete: "cascade" }),
    status: dunningRunStatus().notNull().default("active"),
    startedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    pausedAt: timestamp({ withTimezone: true }),
    stoppedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.status)],
);

/** Step 1 = day 0 friendly reminder, 2 = day 3 reminder, 3 = day 7 final notice. */
export const dunningSteps = pgTable(
  "dunning_steps",
  {
    id: uuid().primaryKey().defaultRandom(),
    runId: uuid()
      .notNull()
      .references(() => dunningRuns.id, { onDelete: "cascade" }),
    step: smallint().notNull(),
    dayOffset: smallint().notNull(),
    scheduledFor: timestamp({ withTimezone: true }).notNull(),
    status: dunningStepStatus().notNull().default("pending"),
    /** The email created for approval when the step became due. */
    emailId: uuid().references(() => emails.id, { onDelete: "set null" }),
    processedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.runId, t.step), index().on(t.status, t.scheduledFor)],
);
