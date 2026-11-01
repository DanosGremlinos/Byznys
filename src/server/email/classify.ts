import "server-only";
import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { emails } from "@/db/schema";
import { aiConfigured } from "@/server/ai/client";
import { classifyReply } from "@/server/ai/messaging";

/** AI classification of an inbound email; leaves it unclassified when AI isn't configured or fails. */
export async function classifyInboundEmail(db: Database, emailId: string): Promise<boolean> {
  if (!aiConfigured()) return false;
  const email = await db.query.emails.findFirst({ where: eq(emails.id, emailId) });
  if (!email || email.direction !== "inbound" || email.classificationSource === "manual") return false;
  const previous = await db.query.emails.findFirst({
    where: and(eq(emails.threadId, email.threadId), eq(emails.direction, "outbound")),
    orderBy: desc(emails.createdAt),
  });
  try {
    const r = await classifyReply({
      text: email.bodyText.slice(0, 8000),
      subject: email.subject,
      context: previous?.bodyText.slice(0, 2000),
    });
    await db
      .update(emails)
      .set({
        classification: r.classification,
        classificationSource: "ai",
        classificationConfidence: r.confidence,
        classificationReason: r.reason,
      })
      .where(and(eq(emails.id, emailId)));
    return true;
  } catch (err) {
    console.error(`[classify] ${emailId}: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}
