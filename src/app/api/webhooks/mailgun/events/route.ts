import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { webhookEvents } from "@/db/schema";
import { addToBlacklist } from "@/server/email/blacklist";
import { verifyMailgunSignature } from "@/server/email/mailgun";

type MailgunEvent = {
  signature?: { timestamp: string; token: string; signature: string };
  "event-data"?: { id?: string; event?: string; severity?: string; recipient?: string; reason?: string };
};

/** Mailgun event webhooks: permanent failures, complaints and unsubscribes go to the blacklist. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as MailgunEvent;
  if (
    !body.signature ||
    !verifyMailgunSignature(process.env.MAILGUN_WEBHOOK_SIGNING_KEY ?? "", body.signature)
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  const data = body["event-data"] ?? {};
  const [event] = await db
    .insert(webhookEvents)
    .values({
      provider: "mailgun",
      externalId: `event:${data.id ?? body.signature.token}`,
      eventType: data.event ?? "unknown",
      payload: data as Record<string, unknown>,
    })
    .onConflictDoNothing()
    .returning();
  if (!event) return NextResponse.json({ ok: true, duplicate: true });

  if (data.recipient) {
    if (data.event === "failed" && data.severity === "permanent") {
      await addToBlacklist(db, data.recipient, "bounced", data.reason ?? "Trvalé nedoručení (Mailgun)");
    } else if (data.event === "complained") {
      await addToBlacklist(db, data.recipient, "complained", "Označeno jako spam (Mailgun)");
    } else if (data.event === "unsubscribed") {
      await addToBlacklist(db, data.recipient, "unsubscribed", "Odhlášeno přes Mailgun");
    }
  }
  await db.update(webhookEvents).set({ processedAt: new Date() }).where(eq(webhookEvents.id, event.id));
  return NextResponse.json({ ok: true });
}
