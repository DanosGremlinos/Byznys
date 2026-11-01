CREATE TYPE "public"."asset_source" AS ENUM('scraped', 'upload');--> statement-breakpoint
CREATE TYPE "public"."blacklist_reason" AS ENUM('unsubscribed', 'bounced', 'complained', 'manual');--> statement-breakpoint
CREATE TYPE "public"."builder_asset_kind" AS ENUM('photo', 'logo', 'review', 'document');--> statement-breakpoint
CREATE TYPE "public"."classification_source" AS ENUM('ai', 'manual');--> statement-breakpoint
CREATE TYPE "public"."dunning_run_status" AS ENUM('active', 'paused', 'stopped_paid', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."dunning_step_status" AS ENUM('pending', 'queued_for_approval', 'sent', 'skipped', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."email_direction" AS ENUM('outbound', 'inbound');--> statement-breakpoint
CREATE TYPE "public"."email_kind" AS ENUM('offer_l1', 'offer_l2', 'offer_l3', 'dunning_1', 'dunning_2', 'dunning_3', 'reply', 'custom');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('draft', 'pending_approval', 'approved', 'sending', 'sent', 'failed', 'rejected', 'blocked', 'received');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('issued', 'paid', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."job_type" AS ENUM('lead_search', 'site_analysis', 'dunning_run');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('new', 'contacted', 'converted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."reply_classification" AS ENUM('interested', 'not_interested', 'question', 'change_request');--> statement-breakpoint
CREATE TYPE "public"."subscription_event_type" AS ENUM('created', 'upgraded', 'downgraded', 'paused', 'resumed', 'cancelled', 'renewed', 'invoice_issued', 'payment_received', 'website_suspended', 'website_reactivated');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'paused', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."website_status" AS ENUM('draft', 'in_progress', 'live', 'suspended', 'cancelled');--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "job_type" NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"progress" jsonb,
	"result" jsonb,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"url" text NOT NULL,
	"source" text NOT NULL,
	"attribution" text,
	"width" integer,
	"height" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"author" text NOT NULL,
	"rating" integer NOT NULL,
	"text" text NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_site_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"url" text NOT NULL,
	"final_url" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"http_status" integer,
	"is_https" boolean,
	"copyright_year" integer,
	"tech_signals" jsonb,
	"has_title" boolean,
	"has_meta_description" boolean,
	"has_h_1" boolean,
	"has_viewport_meta" boolean,
	"pagespeed_mobile" integer,
	"pagespeed_desktop" integer,
	"design_issues" jsonb,
	"error" text,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" text,
	"search_job_id" uuid,
	"name" text NOT NULL,
	"category" text,
	"address" text,
	"city" text,
	"lat" double precision,
	"lng" double precision,
	"phone" text,
	"email" text,
	"website_url" text,
	"google_maps_url" text,
	"opening_hours" jsonb,
	"services" jsonb,
	"social_links" jsonb,
	"rating" real,
	"review_count" integer,
	"logo_url" text,
	"brand_colors" jsonb,
	"contact_person" text,
	"status" "lead_status" DEFAULT 'new' NOT NULL,
	"score" integer,
	"score_factors" jsonb,
	"score_version" text,
	"scored_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leads_placeId_unique" UNIQUE("place_id")
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_name" text NOT NULL,
	"ico" text,
	"dic" text,
	"contact_person" text,
	"email" text,
	"phone" text,
	"address" text,
	"city" text,
	"notes" text,
	"lead_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "websites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"name" text NOT NULL,
	"domain" text,
	"status" "website_status" DEFAULT 'draft' NOT NULL,
	"live_url" text,
	"preview_url" text,
	"screenshot_url" text,
	"launched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "builder_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" "builder_asset_kind" NOT NULL,
	"source" "asset_source" NOT NULL,
	"url" text,
	"blob_pathname" text,
	"filename" text,
	"content_type" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_hero" boolean DEFAULT false NOT NULL,
	"is_selected" boolean DEFAULT true NOT NULL,
	"lead_photo_id" uuid,
	"lead_review_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "builder_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"lead_id" uuid,
	"website_id" uuid,
	"client_info" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"structure" jsonb DEFAULT '{"mode":"one-page","pages":[],"sections":[],"extras":[]}'::jsonb NOT NULL,
	"style" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"custom_instructions" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "builder_prompt_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "builder_prompt_versions_projectId_version_unique" UNIQUE("project_id","version")
);
--> statement-breakpoint
CREATE TABLE "contract_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"body" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"website_id" uuid,
	"template_id" uuid,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"pdf_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_id" uuid NOT NULL,
	"url" text NOT NULL,
	"blob_pathname" text,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_blacklist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"reason" "blacklist_reason" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_blacklist_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"kind" "email_kind" NOT NULL,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_templates_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "email_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid,
	"lead_id" uuid,
	"subject" text NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"direction" "email_direction" NOT NULL,
	"status" "email_status" NOT NULL,
	"kind" "email_kind",
	"template_id" uuid,
	"from_address" text NOT NULL,
	"to_address" text NOT NULL,
	"subject" text NOT NULL,
	"body_text" text NOT NULL,
	"body_html" text,
	"provider_message_id" text,
	"message_id_header" text,
	"in_reply_to" text,
	"classification" "reply_classification",
	"classification_source" "classification_source",
	"classification_confidence" real,
	"classification_reason" text,
	"read_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"external_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_events_provider_externalId_unique" UNIQUE("provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "dunning_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"status" "dunning_run_status" DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paused_at" timestamp with time zone,
	"stopped_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dunning_runs_invoiceId_unique" UNIQUE("invoice_id")
);
--> statement-breakpoint
CREATE TABLE "dunning_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"step" smallint NOT NULL,
	"day_offset" smallint NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"status" "dunning_step_status" DEFAULT 'pending' NOT NULL,
	"email_id" uuid,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dunning_steps_runId_step_unique" UNIQUE("run_id","step")
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"subscription_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"amount_halere" integer NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"issued_on" date NOT NULL,
	"due_date" date NOT NULL,
	"variable_symbol" text NOT NULL,
	"status" "invoice_status" DEFAULT 'issued' NOT NULL,
	"paid_at" timestamp with time zone,
	"paid_amount_halere" integer,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "subscription_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"type" "subscription_event_type" NOT NULL,
	"from_tier_id" uuid,
	"to_tier_id" uuid,
	"from_price_halere" integer,
	"to_price_halere" integer,
	"amount_halere" integer,
	"note" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"monthly_price_halere" integer NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_tiers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"website_id" uuid NOT NULL,
	"tier_id" uuid NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"price_halere" integer NOT NULL,
	"started_on" date NOT NULL,
	"next_billing_date" date,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_websiteId_unique" UNIQUE("website_id")
);
--> statement-breakpoint
ALTER TABLE "lead_photos" ADD CONSTRAINT "lead_photos_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_reviews" ADD CONSTRAINT "lead_reviews_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_site_analyses" ADD CONSTRAINT "lead_site_analyses_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_search_job_id_jobs_id_fk" FOREIGN KEY ("search_job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "websites" ADD CONSTRAINT "websites_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_assets" ADD CONSTRAINT "builder_assets_project_id_builder_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."builder_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_assets" ADD CONSTRAINT "builder_assets_lead_photo_id_lead_photos_id_fk" FOREIGN KEY ("lead_photo_id") REFERENCES "public"."lead_photos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_assets" ADD CONSTRAINT "builder_assets_lead_review_id_lead_reviews_id_fk" FOREIGN KEY ("lead_review_id") REFERENCES "public"."lead_reviews"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_projects" ADD CONSTRAINT "builder_projects_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_projects" ADD CONSTRAINT "builder_projects_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_prompt_versions" ADD CONSTRAINT "builder_prompt_versions_project_id_builder_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."builder_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_template_id_contract_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."contract_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_email_id_emails_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."emails"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_thread_id_email_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."email_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_template_id_email_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dunning_runs" ADD CONSTRAINT "dunning_runs_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dunning_steps" ADD CONSTRAINT "dunning_steps_run_id_dunning_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."dunning_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dunning_steps" ADD CONSTRAINT "dunning_steps_email_id_emails_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."emails"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_from_tier_id_subscription_tiers_id_fk" FOREIGN KEY ("from_tier_id") REFERENCES "public"."subscription_tiers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_to_tier_id_subscription_tiers_id_fk" FOREIGN KEY ("to_tier_id") REFERENCES "public"."subscription_tiers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tier_id_subscription_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."subscription_tiers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jobs_status_run_after_index" ON "jobs" USING btree ("status","run_after");--> statement-breakpoint
CREATE INDEX "jobs_type_created_at_index" ON "jobs" USING btree ("type","created_at");--> statement-breakpoint
CREATE INDEX "lead_photos_lead_id_index" ON "lead_photos" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_reviews_lead_id_rating_index" ON "lead_reviews" USING btree ("lead_id","rating");--> statement-breakpoint
CREATE INDEX "lead_site_analyses_lead_id_fetched_at_index" ON "lead_site_analyses" USING btree ("lead_id","fetched_at");--> statement-breakpoint
CREATE INDEX "leads_score_index" ON "leads" USING btree ("score");--> statement-breakpoint
CREATE INDEX "leads_status_index" ON "leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "leads_city_index" ON "leads" USING btree ("city");--> statement-breakpoint
CREATE INDEX "leads_category_index" ON "leads" USING btree ("category");--> statement-breakpoint
CREATE INDEX "clients_lead_id_index" ON "clients" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "websites_client_id_index" ON "websites" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "websites_status_index" ON "websites" USING btree ("status");--> statement-breakpoint
CREATE INDEX "builder_assets_project_id_sort_order_index" ON "builder_assets" USING btree ("project_id","sort_order");--> statement-breakpoint
CREATE INDEX "builder_projects_lead_id_index" ON "builder_projects" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "builder_projects_website_id_index" ON "builder_projects" USING btree ("website_id");--> statement-breakpoint
CREATE INDEX "contracts_client_id_index" ON "contracts" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "email_attachments_email_id_index" ON "email_attachments" USING btree ("email_id");--> statement-breakpoint
CREATE INDEX "email_threads_client_id_index" ON "email_threads" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "email_threads_lead_id_index" ON "email_threads" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "email_threads_last_message_at_index" ON "email_threads" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "emails_thread_id_created_at_index" ON "emails" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "emails_status_index" ON "emails" USING btree ("status");--> statement-breakpoint
CREATE INDEX "emails_direction_read_at_index" ON "emails" USING btree ("direction","read_at");--> statement-breakpoint
CREATE INDEX "emails_message_id_header_index" ON "emails" USING btree ("message_id_header");--> statement-breakpoint
CREATE INDEX "dunning_runs_status_index" ON "dunning_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "dunning_steps_status_scheduled_for_index" ON "dunning_steps" USING btree ("status","scheduled_for");--> statement-breakpoint
CREATE INDEX "invoices_status_due_date_index" ON "invoices" USING btree ("status","due_date");--> statement-breakpoint
CREATE INDEX "invoices_client_id_index" ON "invoices" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "invoices_subscription_id_index" ON "invoices" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "subscription_events_occurred_at_index" ON "subscription_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "subscription_events_subscription_id_index" ON "subscription_events" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "subscriptions_client_id_index" ON "subscriptions" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "subscriptions_status_next_billing_date_index" ON "subscriptions" USING btree ("status","next_billing_date");