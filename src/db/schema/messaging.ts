import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { clients, websites } from "./clients";
import { createdAt, updatedAt } from "./common";
import {
  blacklistReason,
  classificationSource,
  emailDirection,
  emailKind,
  emailStatus,
  replyClassification,
} from "./enums";
import { leads } from "./leads";

export const emailTemplates = pgTable("email_templates", {
  id: uuid().primaryKey().defaultRandom(),
  /** Stable identifier used by code, e.g. "offer_l1_default". */
  key: text().notNull().unique(),
  kind: emailKind().notNull(),
  name: text().notNull(),
  subject: text().notNull(),
  /** Body with {{variable}} placeholders (plain text / light markdown). */
  body: text().notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const emailThreads = pgTable(
  "email_threads",
  {
    id: uuid().primaryKey().defaultRandom(),
    clientId: uuid().references(() => clients.id, { onDelete: "set null" }),
    leadId: uuid().references(() => leads.id, { onDelete: "set null" }),
    subject: text().notNull(),
    lastMessageAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.clientId), index().on(t.leadId), index().on(t.lastMessageAt)],
);

export const emails = pgTable(
  "emails",
  {
    id: uuid().primaryKey().defaultRandom(),
    threadId: uuid()
      .notNull()
      .references(() => emailThreads.id, { onDelete: "cascade" }),
    direction: emailDirection().notNull(),
    status: emailStatus().notNull(),
    kind: emailKind(),
    templateId: uuid().references(() => emailTemplates.id, { onDelete: "set null" }),
    fromAddress: text().notNull(),
    toAddress: text().notNull(),
    subject: text().notNull(),
    bodyText: text().notNull(),
    bodyHtml: text(),
    /** ID returned by the email provider. */
    providerMessageId: text(),
    /** RFC 5322 Message-ID header, used to match replies. */
    messageIdHeader: text(),
    inReplyTo: text(),
    // Inbound classification (AI suggestion, can be overridden manually)
    classification: replyClassification(),
    classificationSource: classificationSource(),
    classificationConfidence: real(),
    classificationReason: text(),
    readAt: timestamp({ withTimezone: true }),
    approvedAt: timestamp({ withTimezone: true }),
    sentAt: timestamp({ withTimezone: true }),
    receivedAt: timestamp({ withTimezone: true }),
    error: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index().on(t.threadId, t.createdAt),
    index().on(t.status),
    index().on(t.direction, t.readAt),
    index().on(t.messageIdHeader),
  ],
);

export const emailAttachments = pgTable(
  "email_attachments",
  {
    id: uuid().primaryKey().defaultRandom(),
    emailId: uuid()
      .notNull()
      .references(() => emails.id, { onDelete: "cascade" }),
    url: text().notNull(),
    blobPathname: text(),
    filename: text().notNull(),
    contentType: text().notNull(),
    sizeBytes: integer(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.emailId)],
);

export const contractTemplates = pgTable("contract_templates", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  /** Body with {{variable}} placeholders, rendered to PDF. */
  body: text().notNull(),
  isDefault: boolean().notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const contracts = pgTable(
  "contracts",
  {
    id: uuid().primaryKey().defaultRandom(),
    clientId: uuid()
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    websiteId: uuid().references(() => websites.id, { onDelete: "set null" }),
    templateId: uuid().references(() => contractTemplates.id, { onDelete: "set null" }),
    title: text().notNull(),
    /** Rendered body snapshot (after variable substitution and manual edits). */
    body: text().notNull(),
    pdfUrl: text(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.clientId)],
);

/** Hard block list checked by the send function. Emails are stored lowercased. */
export const emailBlacklist = pgTable("email_blacklist", {
  id: uuid().primaryKey().defaultRandom(),
  email: text().notNull().unique(),
  reason: blacklistReason().notNull(),
  note: text(),
  createdAt: createdAt(),
});

/** Idempotency log for incoming provider webhooks (Resend, Mailgun). */
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    provider: text().notNull(),
    externalId: text().notNull(),
    eventType: text().notNull(),
    payload: jsonb().$type<Record<string, unknown>>().notNull(),
    processedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.provider, t.externalId)],
);
