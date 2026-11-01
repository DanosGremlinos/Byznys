import { pgEnum } from "drizzle-orm/pg-core";

export const jobType = pgEnum("job_type", ["lead_search", "site_analysis", "dunning_run"]);
export const jobStatus = pgEnum("job_status", ["queued", "running", "succeeded", "failed"]);

export const leadStatus = pgEnum("lead_status", ["new", "contacted", "converted", "rejected"]);

export const websiteStatus = pgEnum("website_status", [
  "draft",
  "in_progress",
  "live",
  "suspended",
  "cancelled",
]);

export const builderAssetKind = pgEnum("builder_asset_kind", ["photo", "logo", "review", "document"]);
export const assetSource = pgEnum("asset_source", ["scraped", "upload"]);

export const emailKind = pgEnum("email_kind", [
  "offer_l1",
  "offer_l2",
  "offer_l3",
  "dunning_1",
  "dunning_2",
  "dunning_3",
  "reply",
  "custom",
]);
export const emailDirection = pgEnum("email_direction", ["outbound", "inbound"]);
export const emailStatus = pgEnum("email_status", [
  // outbound lifecycle
  "draft",
  "pending_approval",
  "approved",
  "sending",
  "sent",
  "failed",
  "rejected",
  "blocked",
  // inbound
  "received",
]);
export const replyClassification = pgEnum("reply_classification", [
  "interested",
  "not_interested",
  "question",
  "change_request",
]);
export const classificationSource = pgEnum("classification_source", ["ai", "manual"]);
export const blacklistReason = pgEnum("blacklist_reason", [
  "unsubscribed",
  "bounced",
  "complained",
  "manual",
]);

export const subscriptionStatus = pgEnum("subscription_status", ["active", "paused", "cancelled"]);
export const subscriptionEventType = pgEnum("subscription_event_type", [
  "created",
  "upgraded",
  "downgraded",
  "paused",
  "resumed",
  "cancelled",
  "payment_received",
  "website_suspended",
  "website_reactivated",
]);

export const dunningRunStatus = pgEnum("dunning_run_status", [
  "active",
  "paused",
  "stopped_paid",
  "completed",
  "cancelled",
]);
export const dunningStepStatus = pgEnum("dunning_step_status", [
  "pending",
  "queued_for_approval",
  "sent",
  "skipped",
  "cancelled",
]);
