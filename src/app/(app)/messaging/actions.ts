"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import {
  contractTemplates,
  contracts,
  emailAttachments,
  emailTemplates,
  emailThreads,
  emails,
} from "@/db/schema";
import { requireAdmin } from "@/lib/auth-guard";
import { aiConfigured } from "@/server/ai/client";
import { draftReply } from "@/server/ai/messaging";
import { syncDunningStepForEmail } from "@/server/billing/dunning";
import { addToBlacklist } from "@/server/email/blacklist";
import { classifyInboundEmail } from "@/server/email/classify";
import { ingestInbound } from "@/server/email/inbound";
import { getEmailProvider } from "@/server/email/provider";
import { normalizeEmail } from "@/server/email/render";
import { sendApprovedEmail } from "@/server/email/send";
import { createOfferDraft, createReplyDraft, senderFrom } from "@/server/messaging/compose";

export type ActionState = { ok?: string; error?: string; warnings?: string[] };

// ---------------------------------------------------------------------------
// Compose (creates a draft in the approval queue — never sends)
// ---------------------------------------------------------------------------

const composeSchema = z.object({
  recipient: z.string().regex(/^(lead|client):[0-9a-f-]{36}$/, "Vyberte adresáta"),
  level: z.enum(["offer_l1", "offer_l2", "offer_budget", "offer_l3"]),
  previewUrl: z.union([z.literal(""), z.string().url("Neplatná URL náhledu")]).optional(),
  screenshotUrl: z
    .union([z.literal(""), z.string().url("Neplatná URL screenshotu").startsWith("https://")])
    .optional(),
  tierId: z.string().optional(),
  price: z.string().optional(),
  packageOfferId: z.union([z.literal(""), z.string().uuid()]).optional(),
  useAi: z.string().optional(),
});

export async function composeOffer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = composeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;
  const [type, id] = d.recipient.split(":");
  const priceCzk = d.price ? Number(d.price.replace(/\s/g, "").replace(",", ".")) : NaN;
  let emailId: string;
  let warnings: string[];
  try {
    ({ emailId, warnings } = await createOfferDraft(db, {
      leadId: type === "lead" ? id : null,
      clientId: type === "client" ? id : null,
      level: d.level,
      previewUrl: d.previewUrl || null,
      screenshotUrl: d.screenshotUrl || null,
      tierId: d.tierId || null,
      priceHalere: Number.isFinite(priceCzk) && priceCzk > 0 ? Math.round(priceCzk * 100) : null,
      packageOfferId: d.level === "offer_l3" ? d.packageOfferId || null : null,
      useAi: d.useAi === "on",
    }));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Návrh se nepodařilo vytvořit." };
  }
  const note = warnings.length ? `&note=${encodeURIComponent(warnings.join(" "))}` : "";
  redirect(`/messaging/queue?email=${emailId}${note}`);
}

// ---------------------------------------------------------------------------
// Approval queue
// ---------------------------------------------------------------------------

const draftSchema = z.object({
  toAddress: z.string().trim().email("Neplatná adresa příjemce"),
  subject: z.string().trim().min(1, "Chybí předmět").max(300),
  bodyText: z.string().trim().min(1, "Chybí text").max(50_000),
});

async function saveDraftFields(emailId: string, formData: FormData): Promise<string | null> {
  const parsed = draftSchema.safeParse({
    toAddress: formData.get("toAddress"),
    subject: formData.get("subject"),
    bodyText: formData.get("bodyText"),
  });
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Neplatná data";
  const [row] = await db
    .update(emails)
    .set({ ...parsed.data, toAddress: normalizeEmail(parsed.data.toAddress) })
    .where(
      and(
        eq(emails.id, emailId),
        inArray(emails.status, ["pending_approval", "approved", "failed", "blocked"]),
      ),
    )
    .returning({ id: emails.id });
  return row ? null : "E-mail už nelze upravit.";
}

export async function saveDraft(
  emailId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const error = await saveDraftFields(emailId, formData);
  if (error) return { error };
  refresh();
  return { ok: "Uloženo." };
}

/** The owner's explicit approval: saves edits and sends. This is the only send path in the app. */
export async function approveAndSend(
  emailId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const error = await saveDraftFields(emailId, formData);
  if (error) return { error };
  // A blocked draft may be retried only after its address left the blacklist; the send function re-checks.
  await db
    .update(emails)
    .set({ status: "pending_approval" })
    .where(and(eq(emails.id, emailId), eq(emails.status, "blocked")));
  const result = await sendApprovedEmail(db, getEmailProvider(), emailId);
  refresh();
  if (!result.ok) return { error: result.error };
  return {
    ok: result.delivered ? "Odesláno." : "Odesláno (vývojový režim: e-mail byl jen zalogován, nedoručen).",
  };
}

export async function rejectDraft(emailId: string) {
  await requireAdmin();
  await db
    .update(emails)
    .set({ status: "rejected" })
    .where(
      and(
        eq(emails.id, emailId),
        inArray(emails.status, ["pending_approval", "approved", "failed", "blocked"]),
      ),
    );
  await syncDunningStepForEmail(db, emailId, "rejected");
  refresh();
  redirect("/messaging/queue");
}

// ---------------------------------------------------------------------------
// Inbox
// ---------------------------------------------------------------------------

export async function markThreadRead(threadId: string) {
  await requireAdmin();
  await db
    .update(emails)
    .set({ readAt: new Date() })
    .where(and(eq(emails.threadId, threadId), eq(emails.direction, "inbound"), isNull(emails.readAt)));
}

const CLASSES = ["interested", "not_interested", "question", "change_request"] as const;

export async function overrideClassification(emailId: string, value: string) {
  await requireAdmin();
  const classification = (CLASSES as readonly string[]).includes(value)
    ? (value as (typeof CLASSES)[number])
    : null;
  await db
    .update(emails)
    .set({
      classification,
      classificationSource: classification ? "manual" : null,
      classificationConfidence: null,
      classificationReason: null,
    })
    .where(and(eq(emails.id, emailId), eq(emails.direction, "inbound")));
  refresh();
}

export async function reclassify(emailId: string): Promise<ActionState> {
  await requireAdmin();
  if (!aiConfigured()) return { error: "Chybí ANTHROPIC_API_KEY – klasifikujte ručně." };
  await db.update(emails).set({ classificationSource: null }).where(eq(emails.id, emailId));
  const ok = await classifyInboundEmail(db, emailId);
  refresh();
  return ok ? { ok: "Překlasifikováno." } : { error: "Klasifikace selhala." };
}

export async function startReply(
  threadId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  let body = String(formData.get("body") ?? "").trim();
  const useAi = formData.get("useAi") === "on";
  const warnings: string[] = [];
  if (useAi) {
    if (!aiConfigured()) warnings.push("AI není nastavená – návrh je prázdný.");
    else {
      const thread = await db.query.emailThreads.findFirst({
        where: eq(emailThreads.id, threadId),
        with: { emails: { orderBy: (e, { asc }) => asc(e.createdAt) } },
      });
      try {
        body = await draftReply({
          subject: thread?.subject ?? "",
          messages: (thread?.emails ?? [])
            .filter((e) => e.direction === "inbound" || e.status === "sent")
            .map((e) => ({
              from: e.direction === "inbound" ? "Klient" : "My",
              text: e.bodyText.slice(0, 4000),
            })),
        });
      } catch (err) {
        warnings.push(`AI odpověď selhala: ${err instanceof Error ? err.message : "chyba"}`);
      }
    }
  }
  if (!body) body = "Dobrý den,\n\n\n\nS pozdravem";
  const email = await createReplyDraft(db, threadId, body);
  const note = warnings.length ? `&note=${encodeURIComponent(warnings.join(" "))}` : "";
  redirect(`/messaging/queue?email=${email.id}${note}`);
}

/** Development only (EMAIL_PROVIDER=log): simulates an incoming reply so the inbox can be tested. */
export async function simulateInbound(
  threadId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  if (process.env.EMAIL_PROVIDER === "mailgun")
    return { error: "Simulace je dostupná jen ve vývojovém režimu." };
  const text = String(formData.get("text") ?? "").trim();
  if (!text) return { error: "Zadejte text odpovědi." };
  const thread = await db.query.emailThreads.findFirst({
    where: eq(emailThreads.id, threadId),
    with: { emails: { orderBy: (e, { desc }) => desc(e.createdAt) } },
  });
  const lastOut = thread?.emails.find((e) => e.direction === "outbound");
  if (!thread || !lastOut) return { error: "Ve vlákně není odchozí e-mail, na který by šlo odpovědět." };
  const { emailId } = await ingestInbound(db, {
    from: lastOut.toAddress,
    to: senderFrom(),
    subject: `Re: ${thread.subject}`,
    text,
    inReplyTo: lastOut.messageIdHeader,
    messageId: `<sim-${crypto.randomUUID()}@test.local>`,
  });
  after(() => classifyInboundEmail(db, emailId));
  refresh();
  return { ok: "Testovací odpověď přidána." };
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const templateSchema = z.object({
  name: z.string().trim().min(1, "Chybí název").max(200),
  subject: z.string().trim().min(1, "Chybí předmět").max(300),
  body: z.string().trim().min(1, "Chybí text").max(20_000),
});

export async function saveEmailTemplate(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const parsed = templateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  await db.update(emailTemplates).set(parsed.data).where(eq(emailTemplates.id, id));
  refresh();
  return { ok: "Šablona uložena." };
}

export async function createCustomTemplate() {
  await requireAdmin();
  await db.insert(emailTemplates).values({
    key: `custom_${crypto.randomUUID().slice(0, 8)}`,
    kind: "custom",
    name: "Nová šablona",
    subject: "Předmět",
    body: "Dobrý den,\n\n\n\nS pozdravem\n{{senderName}}",
  });
  refresh();
}

export async function deleteCustomTemplate(id: string) {
  await requireAdmin();
  await db.delete(emailTemplates).where(and(eq(emailTemplates.id, id), eq(emailTemplates.kind, "custom")));
  refresh();
}

const contractSchema = z.object({
  name: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1, "Chybí text smlouvy").max(50_000),
});

export async function saveContractTemplate(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const parsed = contractSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  await db.update(contractTemplates).set(parsed.data).where(eq(contractTemplates.id, id));
  refresh();
  return { ok: "Šablona smlouvy uložena." };
}

/** Edits the contract attached to a draft (the PDF is rendered from this text when sending). */
export async function saveDraftContract(
  emailId: string,
  contractId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Smlouva nemůže být prázdná." };
  const attached = await db.query.emailAttachments.findFirst({
    where: and(
      eq(emailAttachments.emailId, emailId),
      eq(emailAttachments.url, `/api/contracts/${contractId}/pdf`),
    ),
  });
  const email = await db.query.emails.findFirst({ where: eq(emails.id, emailId) });
  if (!attached || !email || email.status === "sent") return { error: "Smlouvu už nelze upravit." };
  await db.update(contracts).set({ body }).where(eq(contracts.id, contractId));
  refresh();
  return { ok: "Smlouva uložena." };
}

// ---------------------------------------------------------------------------
// Blacklist
// ---------------------------------------------------------------------------

export async function addBlacklistEntry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const email = z.string().trim().email("Neplatná adresa").safeParse(formData.get("email"));
  if (!email.success) return { error: email.error.issues[0]?.message };
  await addToBlacklist(db, email.data, "manual", String(formData.get("note") ?? "").trim() || undefined);
  refresh();
  return { ok: "Adresa přidána na blacklist." };
}
