// Integration: approval-only sending, blacklist hard block, L2 contract, inbound matching.
// Requires TEST_DATABASE_URL; skipped otherwise.
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/db/client";
import { clients, contracts, emailAttachments, emailBlacklist, emails, leads } from "@/db/schema";
import { addToBlacklist } from "@/server/email/blacklist";
import { ingestInbound } from "@/server/email/inbound";
import type { EmailProvider, OutgoingEmail } from "@/server/email/provider";
import { sendApprovedEmail } from "@/server/email/send";
import { eraseLead, exportLead, purgeStaleLeads, recordConsent } from "@/server/leads/privacy";
import { createOfferDraft } from "@/server/messaging/compose";
import { setupTestDb } from "./helpers/db";

const url = process.env.TEST_DATABASE_URL;

class FakeProvider implements EmailProvider {
  readonly name = "log" as const;
  sent: OutgoingEmail[] = [];
  async send(email: OutgoingEmail) {
    this.sent.push(email);
    return { providerMessageId: `fake-${this.sent.length}`, delivered: false };
  }
}

describe.skipIf(!url)("messaging (DB)", () => {
  let db: Database;
  let leadId: string;
  let leadEmail: string;

  beforeAll(async () => {
    db = await setupTestDb(url!);
    const [lead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.status, "new"), sql`${leads.email} is not null`))
      .orderBy(leads.name)
      .limit(1);
    leadId = lead.id;
    leadEmail = lead.email!;
    await db.delete(emailBlacklist).where(eq(emailBlacklist.email, leadEmail.toLowerCase()));
  });
  afterAll(async () => {
    await db?.$close();
  });

  it("creates an L1 draft in the approval queue without sending anything", async () => {
    const provider = new FakeProvider();
    const { emailId } = await createOfferDraft(db, {
      leadId,
      level: "offer_l1",
      previewUrl: "https://nahled.test/x",
      useAi: false,
    });
    const email = await db.query.emails.findFirst({ where: eq(emails.id, emailId) });
    expect(email?.status).toBe("pending_approval");
    expect(email?.bodyText).toContain("https://nahled.test/x");
    expect(provider.sent).toHaveLength(0);
  });

  it("blocks an offer to a lead without consent, keeps the draft, sends once consent is recorded", async () => {
    const provider = new FakeProvider();
    const { emailId, warnings } = await createOfferDraft(db, {
      leadId,
      level: "offer_l1",
      previewUrl: "https://nahled.test/consent",
      useAi: false,
    });
    expect(warnings.join(" ")).toContain("souhlas");
    const blocked = await sendApprovedEmail(db, provider, emailId);
    expect(blocked).toMatchObject({ ok: false, status: "blocked" });
    expect(blocked.ok ? "" : blocked.error).toContain("480/2004");
    expect(provider.sent).toHaveLength(0);
    expect((await db.query.emails.findFirst({ where: eq(emails.id, emailId) }))?.status).toBe(
      "pending_approval",
    );
    await recordConsent(db, leadId, "telefonicky s majitelem");
    const ok = await sendApprovedEmail(db, provider, emailId);
    expect(ok.ok).toBe(true);
  });

  it("refuses to send without the sender's identification (§ 435 OZ)", async () => {
    const provider = new FakeProvider();
    const { emailId } = await createOfferDraft(db, {
      leadId,
      level: "offer_l1",
      previewUrl: "https://nahled.test/ico",
      useAi: false,
    });
    const saved = process.env.PROVIDER_ICO;
    delete process.env.PROVIDER_ICO;
    try {
      const r = await sendApprovedEmail(db, provider, emailId);
      expect(r).toMatchObject({ ok: false, status: "invalid" });
      expect(r.ok ? "" : r.error).toContain("PROVIDER_ICO");
    } finally {
      process.env.PROVIDER_ICO = saved;
    }
    expect(provider.sent).toHaveLength(0);
  });

  it("sends only via explicit approval, once, with an unsubscribe link and threading headers", async () => {
    const provider = new FakeProvider();
    const { emailId } = await createOfferDraft(db, {
      leadId,
      level: "offer_l1",
      previewUrl: "https://nahled.test/y",
      useAi: false,
    });
    const result = await sendApprovedEmail(db, provider, emailId);
    expect(result).toEqual({ ok: true, status: "sent", delivered: false });
    expect(provider.sent).toHaveLength(1);
    const sent = provider.sent[0];
    expect(sent.text).toMatch(/https:\/\/app\.test\/unsubscribe\/[\w-]+\.[\w-]+/);
    expect(sent.headers?.["List-Unsubscribe"]).toMatch(/^<https:\/\/app\.test\/unsubscribe\//);
    expect(sent.messageId).toMatch(/^<[0-9a-f-]+@weby\.test>$/);
    expect(sent.text).toContain("Toto je obchodní sdělení.");
    expect(sent.text).toContain("IČO 12345678");
    expect(sent.text).toContain("https://app.test/ochrana-udaju");
    const again = await sendApprovedEmail(db, provider, emailId);
    expect(again.ok).toBe(false);
    expect(provider.sent).toHaveLength(1);
    const lead = await db.query.leads.findFirst({ where: eq(leads.id, leadId) });
    expect(lead?.status).toBe("contacted");
  });

  it("hard-blocks a blacklisted recipient at send time", async () => {
    const provider = new FakeProvider();
    const { emailId } = await createOfferDraft(db, {
      leadId,
      level: "offer_l1",
      previewUrl: "https://nahled.test/z",
      useAi: false,
    });
    await addToBlacklist(db, leadEmail.toUpperCase(), "unsubscribed");
    const result = await sendApprovedEmail(db, provider, emailId);
    expect(result.ok).toBe(false);
    expect(result.status).toBe("blocked");
    expect(provider.sent).toHaveLength(0);
    const email = await db.query.emails.findFirst({ where: eq(emails.id, emailId) });
    expect(email?.status).toBe("blocked");
    await db.delete(emailBlacklist).where(eq(emailBlacklist.email, leadEmail.toLowerCase()));
  });

  it("refuses unresolved placeholders and inbound/received emails", async () => {
    const provider = new FakeProvider();
    const { emailId } = await createOfferDraft(db, {
      leadId,
      level: "offer_l1",
      previewUrl: null,
      useAi: false,
    });
    const r = await sendApprovedEmail(db, provider, emailId);
    expect(r).toMatchObject({ ok: false, status: "invalid" });
    expect(r.ok ? "" : r.error).toContain("{{previewUrl}}");
    const [inbound] = await db.select().from(emails).where(eq(emails.direction, "inbound")).limit(1);
    expect((await sendApprovedEmail(db, provider, inbound.id)).ok).toBe(false);
    expect(provider.sent).toHaveLength(0);
  });

  it("L2 for a lead creates the client, the contract and a PDF attachment", async () => {
    const provider = new FakeProvider();
    const { emailId, warnings } = await createOfferDraft(db, {
      leadId,
      level: "offer_l2",
      previewUrl: "https://nahled.test/l2",
      useAi: false,
    });
    expect(warnings.join(" ")).toContain("vytvořen klient");
    const client = await db.query.clients.findFirst({ where: eq(clients.leadId, leadId) });
    expect(client).toBeTruthy();
    const contract = await db.query.contracts.findFirst({ where: eq(contracts.clientId, client!.id) });
    expect(contract?.body).toContain(client!.businessName);
    const [att] = await db.select().from(emailAttachments).where(eq(emailAttachments.emailId, emailId));
    expect(att.url).toBe(`/api/contracts/${contract!.id}/pdf`);
    const result = await sendApprovedEmail(db, provider, emailId);
    expect(result.ok).toBe(true);
    const pdf = provider.sent[0].attachments?.[0];
    expect(pdf?.contentType).toBe("application/pdf");
    expect(Buffer.from(pdf!.content.slice(0, 5)).toString()).toBe("%PDF-");
  });

  it("links an inbound reply to its thread by In-Reply-To, and ignores duplicates", async () => {
    const [sent] = await db
      .select()
      .from(emails)
      .where(
        and(
          eq(emails.direction, "outbound"),
          eq(emails.status, "sent"),
          sql`${emails.messageIdHeader} like '<%@weby.test>'`,
        ),
      )
      .limit(1);
    const msg = {
      from: `Majitel <${sent.toAddress}>`,
      to: "nabidky@weby.test",
      subject: `Re: ${sent.subject}`,
      text: "Dobrý den, máme zájem.",
      messageId: "<reply-1@client.test>",
      inReplyTo: sent.messageIdHeader,
    };
    const first = await ingestInbound(db, msg);
    expect(first.threadId).toBe(sent.threadId);
    const dup = await ingestInbound(db, msg);
    expect(dup.emailId).toBe(first.emailId);
  });

  it("falls back to the sender address, then creates a new thread for unknown senders", async () => {
    const known = await ingestInbound(db, {
      from: leadEmail,
      to: "x",
      subject: "Dotaz",
      text: "Kolik to stojí?",
    });
    const thread = await db.query.emailThreads.findFirst({ where: (t, { eq }) => eq(t.id, known.threadId) });
    expect(thread?.leadId).toBe(leadId);
    const unknown = await ingestInbound(db, {
      from: "neznamy@nikdo.test",
      to: "x",
      subject: "Ahoj",
      text: "?",
    });
    expect(unknown.threadId).not.toBe(known.threadId);
  });

  it("exports and erases a lead (GDPR) and purges stale leads without consent", async () => {
    const [other] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.status, "new"), sql`${leads.id} <> ${leadId}`, sql`${leads.email} is not null`))
      .limit(1);
    const exported = await exportLead(db, other.id);
    expect(exported?.lead.name).toBe(other.name);
    expect(await eraseLead(db, other.id, { blacklist: true })).toBe(true);
    expect(await db.query.leads.findFirst({ where: eq(leads.id, other.id) })).toBeUndefined();
    const bl = await db.query.emailBlacklist.findFirst({
      where: eq(emailBlacklist.email, other.email!.toLowerCase()),
    });
    expect(bl).toBeTruthy();

    const longAgo = new Date(Date.now() - 400 * 86_400_000);
    const [stale] = await db
      .insert(leads)
      .values({ name: "Starý lead", status: "new", createdAt: longAgo, updatedAt: longAgo })
      .returning();
    const [consented] = await db
      .insert(leads)
      .values({ name: "Se souhlasem", contactConsentAt: longAgo, createdAt: longAgo, updatedAt: longAgo })
      .returning();
    await db.update(leads).set({ updatedAt: longAgo }).where(eq(leads.id, stale.id));
    await db.update(leads).set({ updatedAt: longAgo }).where(eq(leads.id, consented.id));
    const purged = await purgeStaleLeads(db);
    expect(purged).toBeGreaterThanOrEqual(1);
    expect(await db.query.leads.findFirst({ where: eq(leads.id, stale.id) })).toBeUndefined();
    expect(await db.query.leads.findFirst({ where: eq(leads.id, consented.id) })).toBeTruthy();
  });
});
