import "server-only";
import { and, eq, inArray, isNull, lt, ne, notExists, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { clients, emailThreads, emails, leadPhotos, leadReviews, leadSiteAnalyses, leads } from "@/db/schema";
import { leadRetentionDays } from "@/lib/legal";
import { addToBlacklist } from "@/server/email/blacklist";

// GDPR for leads: sole traders and contact persons are natural persons, so a lead is personal data.
// Consent to commercial email (zák. č. 480/2004 Sb.), export (art. 15/20), erasure (art. 17/21) and
// the retention limit (art. 5(1)(e)).

export async function recordConsent(db: Database, leadId: string, note: string) {
  await db
    .update(leads)
    .set({ contactConsentAt: new Date(), contactConsentNote: note.trim() || null })
    .where(eq(leads.id, leadId));
}

export async function revokeConsent(db: Database, leadId: string) {
  await db
    .update(leads)
    .set({ contactConsentAt: null, contactConsentNote: null })
    .where(eq(leads.id, leadId));
}

/** Everything the app stores about a lead, for a data-subject access request. */
export async function exportLead(db: Database, leadId: string) {
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, leadId) });
  if (!lead) return null;
  const [photos, reviews, analyses, threads] = await Promise.all([
    db.select().from(leadPhotos).where(eq(leadPhotos.leadId, leadId)),
    db.select().from(leadReviews).where(eq(leadReviews.leadId, leadId)),
    db.select().from(leadSiteAnalyses).where(eq(leadSiteAnalyses.leadId, leadId)),
    db.select().from(emailThreads).where(eq(emailThreads.leadId, leadId)),
  ]);
  const messages = threads.length
    ? await db
        .select({
          threadId: emails.threadId,
          direction: emails.direction,
          status: emails.status,
          fromAddress: emails.fromAddress,
          toAddress: emails.toAddress,
          subject: emails.subject,
          bodyText: emails.bodyText,
          sentAt: emails.sentAt,
          receivedAt: emails.receivedAt,
          createdAt: emails.createdAt,
        })
        .from(emails)
        .where(
          inArray(
            emails.threadId,
            threads.map((t) => t.id),
          ),
        )
    : [];
  return {
    exportedAt: new Date().toISOString(),
    lead,
    photos,
    reviews,
    siteAnalyses: analyses.map((a) => ({ ...a, raw: undefined })),
    emailThreads: threads,
    emails: messages,
  };
}

/**
 * Erases a lead with its photos, reviews, analyses and the email threads that belong only to the lead
 * (threads of a client stay: they are part of a contract relationship). With `blacklist`, the address
 * is kept on the blacklist so the person is never contacted again (objection to direct marketing).
 */
export async function eraseLead(db: Database, leadId: string, opts: { blacklist: boolean }) {
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, leadId) });
  if (!lead) return false;
  await db.transaction(async (tx) => {
    await tx.delete(emailThreads).where(and(eq(emailThreads.leadId, leadId), isNull(emailThreads.clientId)));
    await tx.delete(leads).where(eq(leads.id, leadId));
  });
  if (opts.blacklist && lead.email) await addToBlacklist(db, lead.email, "manual", "Výmaz leadu (GDPR)");
  return true;
}

/**
 * Retention: erases leads that gave no consent, never became a client and were not touched for
 * LEAD_RETENTION_DAYS (default 180). Runs from the daily cron. Returns the number erased.
 */
export async function purgeStaleLeads(db: Database, now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - leadRetentionDays() * 86_400_000);
  const stale = await db
    .select({ id: leads.id })
    .from(leads)
    .where(
      and(
        isNull(leads.contactConsentAt),
        ne(leads.status, "converted"),
        lt(leads.updatedAt, cutoff),
        notExists(
          db
            .select({ one: sql`1` })
            .from(clients)
            .where(eq(clients.leadId, leads.id)),
        ),
      ),
    );
  for (const { id } of stale) await eraseLead(db, id, { blacklist: false });
  return stale.length;
}
