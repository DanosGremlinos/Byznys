import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import type { Database } from "@/db/client";
import { contracts, emailAttachments, emailThreads, emails, leads } from "@/db/schema";
import { isCommercialKind, providerIdentity, withSenderFooter } from "@/lib/legal";
import { syncDunningStepForEmail } from "@/server/billing/dunning";
import { renderContractPdf } from "@/server/contracts/pdf";
import { isBlacklisted } from "./blacklist";
import type { EmailProvider, OutgoingEmail } from "./provider";
import {
  addressOf,
  appBaseUrl,
  textToHtml,
  unresolvedPlaceholders,
  unsubscribeUrlFor,
  withUnsubscribe,
} from "./render";

/** Statuses from which the owner may (re)send an email by clicking "Odeslat". */
const SENDABLE = ["pending_approval", "approved", "failed"] as const;

export type SendOutcome =
  | { ok: true; status: "sent"; delivered: boolean }
  | { ok: false; status: "blocked" | "failed" | "invalid"; error: string };

const CONTRACT_PDF = /^\/api\/contracts\/([0-9a-f-]{36})\/pdf$/;

/**
 * Commercial email needs the recipient's prior consent (zák. č. 480/2004 Sb., § 7) – for businesses too.
 * An offer may go out when the lead gave consent (recorded on the lead), when the recipient wrote to us
 * first in this thread, or when the thread belongs to a client (existing customer). Returns the reason
 * for blocking, or null.
 */
export async function consentBlockReason(
  db: Database,
  email: Pick<typeof emails.$inferSelect, "kind" | "threadId">,
): Promise<string | null> {
  if (!isCommercialKind(email.kind)) return null;
  const thread = await db.query.emailThreads.findFirst({ where: eq(emailThreads.id, email.threadId) });
  if (!thread || thread.clientId || !thread.leadId) return null;
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, thread.leadId) });
  if (!lead || lead.contactConsentAt) return null;
  const inbound = await db.query.emails.findFirst({
    where: and(eq(emails.threadId, thread.id), eq(emails.direction, "inbound")),
    columns: { id: true },
  });
  if (inbound) return null;
  return "Lead nedal souhlas se zasíláním obchodních sdělení (zák. č. 480/2004 Sb.). Oslovte ho nejdřív telefonicky nebo osobně a souhlas zaznamenejte v detailu leadu.";
}

/**
 * The ONLY function that sends email. It is called exclusively from the approval queue when the owner
 * clicks "Odeslat" — nothing in the app sends automatically. Hard-blocks blacklisted recipients.
 */
export async function sendApprovedEmail(
  db: Database,
  provider: EmailProvider,
  emailId: string,
): Promise<SendOutcome> {
  const email = await db.query.emails.findFirst({ where: eq(emails.id, emailId) });
  if (!email || email.direction !== "outbound")
    return { ok: false, status: "invalid", error: "E-mail nenalezen." };
  if (!(SENDABLE as readonly string[]).includes(email.status)) {
    return { ok: false, status: "invalid", error: `E-mail ve stavu „${email.status}“ nelze odeslat.` };
  }
  const to = addressOf(email.toAddress);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to))
    return { ok: false, status: "invalid", error: "Neplatná adresa příjemce." };
  const missing = unresolvedPlaceholders(`${email.subject}\n${email.bodyText}`);
  if (missing.length) {
    return {
      ok: false,
      status: "invalid",
      error: `Nevyplněné proměnné: ${missing.map((m) => `{{${m}}}`).join(", ")}`,
    };
  }

  // Sender identification is required in all business correspondence (§ 435 OZ).
  const sender = providerIdentity();
  if (!sender.ok) {
    return {
      ok: false,
      status: "invalid",
      error: `Chybí údaje odesílatele (${sender.missing.join(", ")}) – doplňte je v nastavení prostředí. Každý e-mail musí uvádět jméno, IČO a sídlo.`,
    };
  }

  // Hard block — checked at send time, whatever the state was when the draft was created.
  if (await isBlacklisted(db, to)) {
    await db
      .update(emails)
      .set({ status: "blocked", error: "Adresa je na blacklistu – odeslání zablokováno." })
      .where(eq(emails.id, emailId));
    return { ok: false, status: "blocked", error: "Adresa je na blacklistu – odeslání zablokováno." };
  }

  // No consent for a commercial email: keep the draft in the queue (it can go out once consent is recorded).
  const noConsent = await consentBlockReason(db, email);
  if (noConsent) {
    await db.update(emails).set({ error: noConsent }).where(eq(emails.id, emailId));
    return { ok: false, status: "blocked", error: noConsent };
  }

  // Atomic claim prevents double sending from two clicks.
  const [claimed] = await db
    .update(emails)
    .set({ status: "sending", approvedAt: new Date(), error: null })
    .where(and(eq(emails.id, emailId), inArray(emails.status, [...SENDABLE])))
    .returning();
  if (!claimed) return { ok: false, status: "invalid", error: "E-mail už se odesílá nebo byl odeslán." };

  try {
    const unsubscribeUrl = unsubscribeUrlFor(to);
    const text = withSenderFooter(withUnsubscribe(claimed.bodyText, unsubscribeUrl), {
      identity: sender.identity,
      privacyUrl: `${appBaseUrl()}/ochrana-udaju`,
      commercial: isCommercialKind(claimed.kind),
    });
    const attachments = await db.select().from(emailAttachments).where(eq(emailAttachments.emailId, emailId));
    const image = attachments.find((a) => a.contentType.startsWith("image/") && /^https:\/\//.test(a.url));
    const files: NonNullable<OutgoingEmail["attachments"]> = [];
    for (const a of attachments) {
      const contractId = a.url.match(CONTRACT_PDF)?.[1];
      if (contractId) {
        const contract = await db.query.contracts.findFirst({ where: eq(contracts.id, contractId) });
        if (!contract) throw new Error("Smlouva k příloze nenalezena.");
        files.push({
          filename: a.filename,
          contentType: "application/pdf",
          content: await renderContractPdf(contract.body, contract.title),
        });
      } else if (a !== image && /^https:\/\//.test(a.url)) {
        const res = await fetch(a.url, { signal: AbortSignal.timeout(20_000) });
        if (!res.ok) throw new Error(`Přílohu ${a.filename} se nepodařilo stáhnout.`);
        files.push({
          filename: a.filename,
          contentType: a.contentType,
          content: new Uint8Array(await res.arrayBuffer()),
        });
      }
    }

    const previous = await db
      .select({ id: emails.messageIdHeader })
      .from(emails)
      .where(and(eq(emails.threadId, claimed.threadId), isNotNull(emails.messageIdHeader)))
      .orderBy(asc(emails.createdAt));
    const references = previous.map((p) => p.id!).filter((id) => id !== claimed.messageIdHeader);
    const fromDomain = addressOf(claimed.fromAddress).split("@")[1] ?? "localhost";
    const messageId = `<${randomUUID()}@${fromDomain}>`;
    const html = textToHtml(text, { imageUrl: image?.url });

    const result = await provider.send({
      from: claimed.fromAddress,
      to,
      subject: claimed.subject,
      text,
      html,
      messageId,
      inReplyTo: claimed.inReplyTo ?? references.at(-1) ?? null,
      references,
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      attachments: files,
    });

    const sentAt = new Date();
    await db
      .update(emails)
      .set({
        status: "sent",
        sentAt,
        messageIdHeader: messageId,
        providerMessageId: result.providerMessageId,
        bodyText: text,
        bodyHtml: html,
        error: result.delivered
          ? null
          : `Nedoručeno – poskytovatel „${provider.name}“ (vývojový/testovací režim).`,
      })
      .where(eq(emails.id, emailId));
    const thread = await db.query.emailThreads.findFirst({ where: eq(emailThreads.id, claimed.threadId) });
    await db.update(emailThreads).set({ lastMessageAt: sentAt }).where(eq(emailThreads.id, claimed.threadId));
    if (thread?.leadId && claimed.kind?.startsWith("offer_")) {
      await db
        .update(leads)
        .set({ status: "contacted" })
        .where(and(eq(leads.id, thread.leadId), eq(leads.status, "new")));
    }
    await syncDunningStepForEmail(db, emailId, "sent");
    return { ok: true, status: "sent", delivered: result.delivered };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.update(emails).set({ status: "failed", error: message }).where(eq(emails.id, emailId));
    return { ok: false, status: "failed", error: message };
  }
}
