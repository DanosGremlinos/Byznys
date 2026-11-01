import { eq } from "drizzle-orm";
import { after, NextResponse } from "next/server";
import { db } from "@/db";
import { webhookEvents } from "@/db/schema";
import { classifyInboundEmail } from "@/server/email/classify";
import { ingestInbound } from "@/server/email/inbound";
import { parseMessageIds, verifyMailgunSignature } from "@/server/email/mailgun";

export const maxDuration = 60;

/**
 * Mailgun Route → "forward" action target: incoming replies. Public URL, authenticated by the
 * Mailgun signature (MAILGUN_WEBHOOK_SIGNING_KEY). Idempotent via webhook_events.
 */
export async function POST(request: Request) {
  const form = await request.formData();
  const get = (k: string) => (form.get(k) as string | null) ?? "";
  const sig = { timestamp: get("timestamp"), token: get("token"), signature: get("signature") };
  if (!verifyMailgunSignature(process.env.MAILGUN_WEBHOOK_SIGNING_KEY ?? "", sig)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  const [event] = await db
    .insert(webhookEvents)
    .values({
      provider: "mailgun",
      externalId: `inbound:${sig.token}`,
      eventType: "inbound",
      payload: { from: get("from"), subject: get("subject"), messageId: get("Message-Id") },
    })
    .onConflictDoNothing()
    .returning();
  if (!event) return NextResponse.json({ ok: true, duplicate: true });

  const { emailId } = await ingestInbound(db, {
    from: get("from") || get("sender"),
    to: get("recipient") || get("To"),
    subject: get("subject"),
    text: get("stripped-text") || get("body-plain"),
    html: get("stripped-html") || get("body-html") || null,
    messageId: get("Message-Id") || null,
    inReplyTo: get("In-Reply-To") || null,
    references: parseMessageIds(get("References")),
    receivedAt: sig.timestamp ? new Date(Number(sig.timestamp) * 1000) : new Date(),
  });
  await db.update(webhookEvents).set({ processedAt: new Date() }).where(eq(webhookEvents.id, event.id));
  after(() => classifyInboundEmail(db, emailId));
  return NextResponse.json({ ok: true });
}
