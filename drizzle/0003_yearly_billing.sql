CREATE TYPE "public"."billing_period" AS ENUM('monthly', 'yearly');--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "billing_period" "billing_period" DEFAULT 'monthly' NOT NULL;