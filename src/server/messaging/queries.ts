import "server-only";
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { BUDGET_TEMPLATE } from "@/config/budget-template";
import { db } from "@/db";
import {
  clients,
  contractTemplates,
  emailAttachments,
  emailBlacklist,
  emailTemplates,
  emailThreads,
  emails,
  leads,
  subscriptionTiers,
  websites,
} from "@/db/schema";
import { requireAdmin } from "@/lib/auth-guard";
import { blacklistedAmong } from "@/server/email/blacklist";
import { addressOf } from "@/server/email/render";

const contactName = sql<string | null>`coalesce(${clients.businessName}, ${leads.name})`;

export async function listQueue() {
  await requireAdmin();
  const rows = await db
    .select({
      id: emails.id,
      status: emails.status,
      kind: emails.kind,
      toAddress: emails.toAddress,
      subject: emails.subject,
      error: emails.error,
      createdAt: emails.createdAt,
      threadId: emails.threadId,
      contact: contactName,
    })
    .from(emails)
    .innerJoin(emailThreads, eq(emailThreads.id, emails.threadId))
    .leftJoin(clients, eq(clients.id, emailThreads.clientId))
    .leftJoin(leads, eq(leads.id, emailThreads.leadId))
    .where(
      and(
        eq(emails.direction, "outbound"),
        inArray(emails.status, ["pending_approval", "approved", "failed", "blocked"]),
      ),
    )
    .orderBy(
      sql`case ${emails.status} when 'pending_approval' then 0 when 'failed' then 1 else 2 end`,
      desc(emails.createdAt),
    )
    .limit(200);
  const black = await blacklistedAmong(
    db,
    rows.map((r) => r.toAddress),
  );
  return rows.map((r) => ({ ...r, blacklisted: black.has(addressOf(r.toAddress)) }));
}

export async function getQueueEmail(id: string) {
  await requireAdmin();
  const email = await db.query.emails.findFirst({
    where: eq(emails.id, id),
    with: { attachments: true, thread: { with: { client: true, lead: true } } },
  });
  if (!email) return null;
  const black = await blacklistedAmong(db, [email.toAddress]);
  return { ...email, blacklisted: black.size > 0 };
}

export async function composeOptions() {
  await requireAdmin();
  const [leadRows, clientRows, tiers] = await Promise.all([
    db
      .select({
        id: leads.id,
        name: leads.name,
        email: leads.email,
        status: leads.status,
        score: leads.score,
        city: leads.city,
      })
      .from(leads)
      .where(isNotNull(leads.email))
      .orderBy(sql`${leads.score} desc nulls last`, asc(leads.name)),
    db
      .select({
        id: clients.id,
        name: clients.businessName,
        email: clients.email,
        previewUrl: sql<
          string | null
        >`(select ${websites.previewUrl} from ${websites} where ${websites.clientId} = ${clients.id} order by ${websites.updatedAt} desc limit 1)`,
      })
      .from(clients)
      .where(isNotNull(clients.email))
      .orderBy(asc(clients.businessName)),
    db
      .select()
      .from(subscriptionTiers)
      .where(eq(subscriptionTiers.isActive, true))
      .orderBy(asc(subscriptionTiers.sortOrder)),
  ]);
  const black = await blacklistedAmong(
    db,
    [...leadRows, ...clientRows].map((r) => r.email!),
  );
  return {
    leads: leadRows.map((l) => ({ ...l, blacklisted: black.has(addressOf(l.email!)) })),
    clients: clientRows.map((c) => ({ ...c, blacklisted: black.has(addressOf(c.email!)) })),
    tiers,
  };
}

export type ThreadFilter = "all" | "unread" | "interested" | "not_interested" | "question" | "change_request";

export async function listThreads(filter: ThreadFilter) {
  await requireAdmin();
  const unread = sql<number>`(select count(*)::int from ${emails} e where e.thread_id = ${emailThreads.id} and e.direction = 'inbound' and e.read_at is null)`;
  const inbound = sql<number>`(select count(*)::int from ${emails} e where e.thread_id = ${emailThreads.id} and e.direction = 'inbound')`;
  const lastClassification = sql<
    string | null
  >`(select e.classification::text from ${emails} e where e.thread_id = ${emailThreads.id} and e.direction = 'inbound' order by e.created_at desc limit 1)`;
  const rows = await db
    .select({
      id: emailThreads.id,
      subject: emailThreads.subject,
      lastMessageAt: emailThreads.lastMessageAt,
      contact: contactName,
      clientId: emailThreads.clientId,
      leadId: emailThreads.leadId,
      unread,
      inbound,
      lastClassification,
    })
    .from(emailThreads)
    .leftJoin(clients, eq(clients.id, emailThreads.clientId))
    .leftJoin(leads, eq(leads.id, emailThreads.leadId))
    .orderBy(desc(emailThreads.lastMessageAt))
    .limit(300);
  // The inbox shows conversations with at least one incoming message.
  return rows.filter((r) => {
    if (r.inbound === 0) return false;
    if (filter === "unread") return r.unread > 0;
    if (filter !== "all") return r.lastClassification === filter;
    return true;
  });
}

export async function getThread(id: string) {
  await requireAdmin();
  return (
    (await db.query.emailThreads.findFirst({
      where: eq(emailThreads.id, id),
      with: {
        client: { columns: { id: true, businessName: true, email: true } },
        lead: { columns: { id: true, name: true, email: true } },
        emails: { orderBy: asc(emails.createdAt), with: { attachments: true } },
      },
    })) ?? null
  );
}

export async function listTemplates() {
  await requireAdmin();
  // Built-in templates added after the initial seed must be visible (and editable) before their first use.
  await db.insert(emailTemplates).values(BUDGET_TEMPLATE).onConflictDoNothing({ target: emailTemplates.key });
  const [mail, contract] = await Promise.all([
    db.select().from(emailTemplates).orderBy(asc(emailTemplates.kind), asc(emailTemplates.name)),
    db
      .select()
      .from(contractTemplates)
      .orderBy(desc(contractTemplates.isDefault), asc(contractTemplates.name)),
  ]);
  return { mail, contract };
}

export async function listBlacklist() {
  await requireAdmin();
  return db.select().from(emailBlacklist).orderBy(desc(emailBlacklist.createdAt));
}

export type LevelStats = { kind: string; sent: number; replied: number; interested: number };

export async function messagingStats() {
  await requireAdmin();
  const [byLevel, classes, statuses, monthly, attachmentsCount] = await Promise.all([
    db.execute<LevelStats>(sql`
      WITH o AS (
        SELECT e.id, e.thread_id, e.kind::text AS kind, e.sent_at FROM emails e
        WHERE e.direction = 'outbound' AND e.status = 'sent' AND e.kind IS NOT NULL
      )
      SELECT o.kind,
        count(*)::int AS sent,
        count(*) FILTER (WHERE EXISTS (SELECT 1 FROM emails i WHERE i.thread_id = o.thread_id AND i.direction = 'inbound' AND i.received_at > o.sent_at))::int AS replied,
        count(*) FILTER (WHERE EXISTS (SELECT 1 FROM emails i WHERE i.thread_id = o.thread_id AND i.direction = 'inbound' AND i.received_at > o.sent_at AND i.classification = 'interested'))::int AS interested
      FROM o GROUP BY o.kind ORDER BY CASE WHEN o.kind LIKE 'offer_%' THEN 0 WHEN o.kind = 'reply' THEN 1 ELSE 2 END, o.kind`),
    db
      .select({ classification: emails.classification, n: count() })
      .from(emails)
      .where(eq(emails.direction, "inbound"))
      .groupBy(emails.classification),
    db
      .select({ status: emails.status, n: count() })
      .from(emails)
      .where(eq(emails.direction, "outbound"))
      .groupBy(emails.status),
    db.execute<{ month: string; sent: number; received: number }>(sql`
      SELECT to_char(date_trunc('month', coalesce(sent_at, received_at) AT TIME ZONE 'Europe/Prague'), 'YYYY-MM') AS month,
        count(*) FILTER (WHERE direction = 'outbound')::int AS sent,
        count(*) FILTER (WHERE direction = 'inbound')::int AS received
      FROM emails WHERE coalesce(sent_at, received_at) > now() - interval '6 months'
        AND (status = 'sent' OR direction = 'inbound')
      GROUP BY 1 ORDER BY 1`),
    db.select({ n: count() }).from(emailAttachments),
  ]);
  const unread = await db
    .select({ n: count() })
    .from(emails)
    .where(and(eq(emails.direction, "inbound"), isNull(emails.readAt)));
  return {
    byLevel: [...byLevel],
    classes,
    statuses,
    monthly: [...monthly],
    unread: unread[0]?.n ?? 0,
    attachments: attachmentsCount[0]?.n ?? 0,
  };
}
