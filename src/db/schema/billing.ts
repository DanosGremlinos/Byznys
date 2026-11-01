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
import { dunningRunStatus, dunningStepStatus, subscriptionEventType, subscriptionStatus } from "./enums";
import { emails } from "./messaging";

// No payments or invoices in the app: money is collected outside it (handled personally).
// Each subscription has a "paid until" date that is moved forward manually when a payment
// arrives. A subscription is overdue when paid_until < today (Europe/Prague).

/** Package templates: starting point for a client's subscription (price and features are editable per client). */
export const subscriptionTiers = pgTable("subscription_tiers", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull().unique(),
  description: text(),
  /** Default monthly price used to prefill a new subscription. */
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
    /** Template this subscription was created from / last changed to (optional). */
    tierId: uuid().references(() => subscriptionTiers.id, { onDelete: "set null" }),
    /** Package name shown to the client (prefilled from the template, editable). */
    name: text().notNull(),
    /** Monthly price agreed with this client. */
    priceHalere: integer().notNull(),
    /** Features agreed with this client. */
    features: jsonb().$type<string[]>().notNull().default([]),
    status: subscriptionStatus().notNull().default("active"),
    startedOn: date({ mode: "string" }).notNull(),
    /** Service is paid up to and including this date; the next payment is due the day after. */
    paidUntil: date({ mode: "string" }).notNull(),
    cancelledAt: timestamp({ withTimezone: true }),
    cancelReason: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.clientId), index().on(t.status, t.paidUntil)],
);

/** History of sales, subscription changes and recorded payments (dashboard timeline + revenue chart). */
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
    /** For payment_received: amount received. */
    amountHalere: integer(),
    /** For payment_received: the new paid-until date after recording the payment. */
    paidUntil: date({ mode: "string" }),
    note: text(),
    occurredAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.occurredAt), index().on(t.subscriptionId)],
);

/** Reminder sequence for one missed payment (one subscription, one missed paid-until date). */
export const dunningRuns = pgTable(
  "dunning_runs",
  {
    id: uuid().primaryKey().defaultRandom(),
    subscriptionId: uuid()
      .notNull()
      .references(() => subscriptions.id, { onDelete: "cascade" }),
    /** The paid_until value that was missed; day 0 of the sequence is the day after it. */
    missedPaidUntil: date({ mode: "string" }).notNull(),
    /** Amount expected (snapshot of the monthly price). */
    amountHalere: integer().notNull(),
    status: dunningRunStatus().notNull().default("active"),
    startedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    pausedAt: timestamp({ withTimezone: true }),
    stoppedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique().on(t.subscriptionId, t.missedPaidUntil), index().on(t.status)],
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
