ALTER TYPE "public"."email_kind" ADD VALUE 'offer_budget' BEFORE 'offer_l3';--> statement-breakpoint
CREATE TABLE "package_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"website_id" uuid,
	"budget_halere" integer NOT NULL,
	"packages" jsonb NOT NULL,
	"note" text,
	"email_id" uuid,
	"subscription_id" uuid,
	"chosen_index" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "package_offers" ADD CONSTRAINT "package_offers_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_offers" ADD CONSTRAINT "package_offers_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_offers" ADD CONSTRAINT "package_offers_email_id_emails_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."emails"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_offers" ADD CONSTRAINT "package_offers_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "package_offers_client_id_index" ON "package_offers" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "package_offers_website_id_index" ON "package_offers" USING btree ("website_id");