import "server-only";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { clients, emailThreads, emails, leads } from "@/db/schema";
import { addressOf } from "./render";

export type InboundMessage = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string | null;
  messageId?: string | null;
  inReplyTo?: string | null;
  references?: string[];
  receivedAt?: Date;
};

/** Finds the thread a reply belongs to: by message IDs first, then by the sender's address. */
export async function findThreadFor(db: Database, msg: InboundMessage): Promise<string | null> {
  const ids = [msg.inReplyTo, ...(msg.references ?? [])].filter((x): x is string => Boolean(x));
  if (ids.length) {
    const [hit] = await db
      .select({ threadId: emails.threadId })
      .from(emails)
      .where(inArray(emails.messageIdHeader, ids))
      .orderBy(desc(emails.createdAt))
      .limit(1);
    if (hit) return hit.threadId;
  }
  const sender = addressOf(msg.from);
  const [byAddress] = await db
    .select({ threadId: emails.threadId })
    .from(emails)
    .where(
      or(
        sql`lower(${emails.toAddress}) = ${sender}`,
        sql`lower(${emails.fromAddress}) like ${"%" + sender + "%"}`,
      ),
    )
    .orderBy(desc(emails.createdAt))
    .limit(1);
  return byAddress?.threadId ?? null;
}

/** Stores an incoming email, linking it to an existing thread or a new one for the matching client/lead. */
export async function ingestInbound(
  db: Database,
  msg: InboundMessage,
): Promise<{ emailId: string; threadId: string }> {
  if (msg.messageId) {
    const dup = await db.query.emails.findFirst({ where: eq(emails.messageIdHeader, msg.messageId) });
    if (dup) return { emailId: dup.id, threadId: dup.threadId };
  }
  const receivedAt = msg.receivedAt ?? new Date();
  let threadId = await findThreadFor(db, msg);
  if (!threadId) {
    const sender = addressOf(msg.from);
    const [client] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(sql`lower(${clients.email}) = ${sender}`)
      .limit(1);
    const [lead] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(sql`lower(${leads.email}) = ${sender}`)
      .limit(1);
    const [thread] = await db
      .insert(emailThreads)
      .values({
        clientId: client?.id ?? null,
        leadId: lead?.id ?? null,
        subject: msg.subject.replace(/^(re|fwd?|odp):\s*/i, "") || "(bez předmětu)",
        lastMessageAt: receivedAt,
      })
      .returning();
    threadId = thread.id;
  }
  const [row] = await db
    .insert(emails)
    .values({
      threadId,
      direction: "inbound",
      status: "received",
      fromAddress: msg.from,
      toAddress: msg.to,
      subject: msg.subject || "(bez předmětu)",
      bodyText: msg.text || "",
      bodyHtml: msg.html ?? null,
      messageIdHeader: msg.messageId ?? null,
      inReplyTo: msg.inReplyTo ?? null,
      receivedAt,
    })
    .returning();
  await db
    .update(emailThreads)
    .set({ lastMessageAt: receivedAt })
    .where(
      and(eq(emailThreads.id, threadId), sql`${emailThreads.lastMessageAt} < ${receivedAt.toISOString()}`),
    );
  return { emailId: row.id, threadId };
}
