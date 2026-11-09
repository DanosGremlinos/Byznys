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
      webPriceHalere: 599_000,
      generateContract: true,
      useAi: false,
    });
    expect(warnings.join(" ")).toContain("vytvořen klient");
    const client = await db.query.clients.findFirst({ where: eq(clients.leadId, leadId) });
    expect(client).toBeTruthy();
    const contract = await db.query.contracts.findFirst({ where: eq(contracts.clientId, client!.id) });
    expect(contract?.body).toContain(client!.businessName);
    expect(contract?.body).toContain("5 990 Kč");
    const [att] = await db.select().from(emailAttachments).where(eq(emailAttachments.emailId, emailId));
    expect(att.url).toBe(`/api/contracts/${contract!.id}/pdf`);
    const result = await sendApprovedEmail(db, provider, emailId);
    expect(result.ok).toBe(true);
    const pdf = provider.sent[0].attachments?.[0];
    expect(pdf?.contentType).toBe("application/pdf");
    expect(Buffer.from(pdf!.content.slice(0, 5)).toString()).toBe("%PDF-");
  });

  it("sends a file uploaded to the draft (own contract for signing) as an attachment", async () => {
    const provider = new FakeProvider();
    const { emailId } = await createOfferDraft(db, {
      leadId,
      level: "offer_l2",
      previewUrl: "https://nahled.test/l2b",
      webPriceHalere: 599_000,
      useAi: false,
    });
    expect(await db.select().from(emailAttachments).where(eq(emailAttachments.emailId, emailId))).toHaveLength(0);
    const bytes = new TextEncoder().encode("%PDF-1.4 vlastni smlouva");
    await db.insert(emailAttachments).values({
      emailId,
      url: "/api/attachments/x",
      filename: "smlouva.pdf",
      contentType: "application/pdf",
      sizeBytes: bytes.length,
      content: bytes,
    });
    const result = await sendApprovedEmail(db, provider, emailId);
    expect(result.ok).toBe(true);
    const sent = provider.sent[0].attachments ?? [];
    expect(sent).toHaveLength(1);
    expect(sent[0].filename).toBe("smlouva.pdf");
    expect(Buffer.from(sent[0].content).toString()).toBe("%PDF-1.4 vlastni smlouva");
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
});
