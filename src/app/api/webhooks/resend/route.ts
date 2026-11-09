import { eq } from "drizzle-orm";
import { after, NextResponse } from "next/server";
import { db } from "@/db";
import { webhookEvents } from "@/db/schema";
import { addToBlacklist } from "@/server/email/blacklist";
import { classifyInboundEmail } from "@/server/email/classify";
import { ingestInbound } from "@/server/email/inbound";
import { parseMessageIds } from "@/server/email/mailgun";
import {
  fetchReceivedEmail,
  headerOf,
  resendSignatureHeaders,
  verifyResendSignature,
} from "@/server/email/resend";

export const maxDuration = 60;

type ResendEvent = {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[];
    bounce?: { type?: string; subType?: string; message?: string };
    suppressed?: { type?: string; message?: string };
  };
};

/**
 * Resend webhook (one endpoint for all events). Public URL, authenticated by the signature
 * (RESEND_WEBHOOK_SECRET, `whsec_…`). Idempotent via webhook_events keyed by the delivery id.
 * - email.bounced (permanent) / email.complained / email.suppressed → blacklist
 * - email.received → reply stored in the inbox and classified
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const sig = resendSignatureHeaders(request.headers);
  if (!verifyResendSignature(process.env.RESEND_WEBHOOK_SECRET ?? "", sig, raw)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  let body: ResendEvent;
  try {
    body = JSON.parse(raw) as ResendEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const data = body.data ?? {};
  const [event] = await db
    .insert(webhookEvents)
    .values({
      provider: "resend",
      externalId: sig.id!,
      eventType: body.type ?? "unknown",
      payload: body as Record<string, unknown>,
    })
    .onConflictDoNothing()
    .returning();
  if (!event) return NextResponse.json({ ok: true, duplicate: true });

  const recipient = data.to?.[0];
  if (body.type === "email.received" && data.email_id) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "RESEND_API_KEY missing" }, { status: 500 });
    let mail;
    try {
      mail = await fetchReceivedEmail(apiKey, data.email_id);
    } catch (err) {
      // Let Resend retry: forget this delivery so the retry is processed.
      await db.delete(webhookEvents).where(eq(webhookEvents.id, event.id));
      throw err;
    }
    const { emailId } = await ingestInbound(db, {
      from: mail.from,
      to: mail.to.join(", "),
      subject: mail.subject ?? "",
      text: mail.text ?? "",
      html: mail.html,
      messageId: mail.message_id || headerOf(mail.headers, "message-id"),
      inReplyTo: headerOf(mail.headers, "in-reply-to"),
      references: parseMessageIds(headerOf(mail.headers, "references")),
      receivedAt: mail.created_at ? new Date(mail.created_at) : new Date(),
    });
    after(() => classifyInboundEmail(db, emailId));
  } else if (recipient) {
    if (body.type === "email.bounced" && data.bounce?.type?.toLowerCase() === "permanent") {
      await addToBlacklist(db, recipient, "bounced", data.bounce.message ?? "Trvalé nedoručení (Resend)");
    } else if (body.type === "email.complained") {
      await addToBlacklist(db, recipient, "complained", "Označeno jako spam (Resend)");
    } else if (body.type === "email.suppressed") {
      await addToBlacklist(
        db,
        recipient,
        "bounced",
        data.suppressed?.message ?? "Adresa je v Resendu na seznamu potlačených",
      );
    }
  }
  await db.update(webhookEvents).set({ processedAt: new Date() }).where(eq(webhookEvents.id, event.id));
  return NextResponse.json({ ok: true });
}
