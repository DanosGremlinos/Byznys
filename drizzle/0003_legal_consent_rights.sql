ALTER TABLE "leads" ADD COLUMN "contact_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "contact_consent_note" text;--> statement-breakpoint
ALTER TABLE "builder_assets" ADD COLUMN "rights_confirmed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Own uploads are the owner's or the client's material: treat them as cleared.
UPDATE "builder_assets" SET "rights_confirmed" = true WHERE "source" = 'upload';
