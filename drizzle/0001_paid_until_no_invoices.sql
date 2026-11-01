-- Note: constraints are dropped before the invoices table (drizzle-kit emitted them after DROP TABLE ... CASCADE).
ALTER TABLE "dunning_runs" DROP CONSTRAINT "dunning_runs_invoiceId_unique";--> statement-breakpoint
ALTER TABLE "dunning_runs" DROP CONSTRAINT "dunning_runs_invoice_id_invoices_id_fk";--> statement-breakpoint
DROP TABLE "invoices";--> statement-breakpoint
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_tier_id_subscription_tiers_id_fk";
--> statement-breakpoint
ALTER TABLE "subscription_events" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."subscription_event_type";--> statement-breakpoint
CREATE TYPE "public"."subscription_event_type" AS ENUM('created', 'upgraded', 'downgraded', 'paused', 'resumed', 'cancelled', 'payment_received', 'website_suspended', 'website_reactivated');--> statement-breakpoint
ALTER TABLE "subscription_events" ALTER COLUMN "type" SET DATA TYPE "public"."subscription_event_type" USING "type"::"public"."subscription_event_type";--> statement-breakpoint
DROP INDEX "subscriptions_status_next_billing_date_index";--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "tier_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "dunning_runs" ADD COLUMN "subscription_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "dunning_runs" ADD COLUMN "missed_paid_until" date NOT NULL;--> statement-breakpoint
ALTER TABLE "dunning_runs" ADD COLUMN "amount_halere" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD COLUMN "paid_until" date;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "features" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "paid_until" date NOT NULL;--> statement-breakpoint
ALTER TABLE "dunning_runs" ADD CONSTRAINT "dunning_runs_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tier_id_subscription_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."subscription_tiers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscriptions_status_paid_until_index" ON "subscriptions" USING btree ("status","paid_until");--> statement-breakpoint
ALTER TABLE "dunning_runs" DROP COLUMN "invoice_id";--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN "next_billing_date";--> statement-breakpoint
ALTER TABLE "dunning_runs" ADD CONSTRAINT "dunning_runs_subscriptionId_missedPaidUntil_unique" UNIQUE("subscription_id","missed_paid_until");--> statement-breakpoint
DROP TYPE "public"."invoice_status";