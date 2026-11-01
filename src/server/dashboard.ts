import "server-only";
import { and, count, desc, eq, gte, inArray, isNull, sql, sum } from "drizzle-orm";
import { db } from "@/db";
import {
  clients,
  emailThreads,
  emails,
  leads,
  subscriptionEvents,
  subscriptionTiers,
  subscriptions,
  websites,
} from "@/db/schema";
import { requireAdmin } from "@/lib/auth-guard";
import { fillMonths, type RevenuePoint } from "@/lib/revenue";

const OFFER_KINDS = ["offer_l1", "offer_l2", "offer_l3"] as const;
const DAY = 86_400_000;

export type DashboardStats = {
  activeWebsites: number;
  activeSubscriptions: number;
  mrrHalere: number;
  newLeadsWeek: number;
  offersSent30d: number;
  /** Share of offer threads (all time) that received at least one reply, 0–1. */
  replyRate: number | null;
  /** Converted leads / leads that were contacted (contacted + converted + rejected), 0–1. */
  conversionRate: number | null;
};

export async function getDashboardStats(at?: Date): Promise<DashboardStats> {
  await requireAdmin();
  const now = at ?? new Date();
  const weekAgo = new Date(now.getTime() - 7 * DAY);
  const monthAgo = new Date(now.getTime() - 30 * DAY);
  const [[web], [subs], [newLeads], [offers], [replies], leadCounts] = await Promise.all([
    db.select({ n: count() }).from(websites).where(eq(websites.status, "live")),
    db
      .select({ n: count(), mrr: sum(subscriptions.priceHalere).mapWith(Number) })
      .from(subscriptions)
      .where(eq(subscriptions.status, "active")),
    db.select({ n: count() }).from(leads).where(gte(leads.createdAt, weekAgo)),
    db
      .select({ n: count() })
      .from(emails)
      .where(
        and(
          eq(emails.direction, "outbound"),
          eq(emails.status, "sent"),
          inArray(emails.kind, [...OFFER_KINDS]),
          gte(emails.sentAt, monthAgo),
        ),
      ),
    db.execute<{ offered: number; replied: number }>(sql`
      WITH offered AS (
        SELECT thread_id, min(sent_at) AS first_sent FROM emails
        WHERE direction = 'outbound' AND status = 'sent' AND kind IN ('offer_l1', 'offer_l2', 'offer_l3')
        GROUP BY thread_id
      )
      SELECT count(*)::int AS offered,
             count(*) FILTER (WHERE EXISTS (
               SELECT 1 FROM emails i WHERE i.thread_id = o.thread_id AND i.direction = 'inbound' AND i.received_at > o.first_sent
             ))::int AS replied
      FROM offered o`),
    db.select({ status: leads.status, n: count() }).from(leads).groupBy(leads.status),
  ]);
  const byStatus = Object.fromEntries(leadCounts.map((r) => [r.status, r.n])) as Record<string, number>;
  const contacted = (byStatus.contacted ?? 0) + (byStatus.converted ?? 0) + (byStatus.rejected ?? 0);
  return {
    activeWebsites: web.n,
    activeSubscriptions: subs.n,
    mrrHalere: subs.mrr ?? 0,
    newLeadsWeek: newLeads.n,
    offersSent30d: offers.n,
    replyRate: replies.offered ? replies.replied / replies.offered : null,
    conversionRate: contacted ? (byStatus.converted ?? 0) / contacted : null,
  };
}

export type WebsiteTile = {
  id: string;
  name: string;
  domain: string | null;
  status: (typeof websites.$inferSelect)["status"];
  liveUrl: string | null;
  previewUrl: string | null;
  clientId: string;
  clientName: string;
  subscription: {
    name: string;
    tierName: string | null;
    priceHalere: number;
    paidUntil: string;
    status: string;
  } | null;
  unreadCount: number;
  unreadThreadId: string | null;
};

export async function getWebsiteTiles(): Promise<WebsiteTile[]> {
  await requireAdmin();
  const rows = await db
    .select({
      id: websites.id,
      name: websites.name,
      domain: websites.domain,
      status: websites.status,
      liveUrl: websites.liveUrl,
      previewUrl: websites.previewUrl,
      clientId: clients.id,
      clientName: clients.businessName,
      subName: subscriptions.name,
      subPrice: subscriptions.priceHalere,
      subPaidUntil: subscriptions.paidUntil,
      subStatus: subscriptions.status,
      tierName: subscriptionTiers.name,
    })
    .from(websites)
    .innerJoin(clients, eq(clients.id, websites.clientId))
    .leftJoin(subscriptions, eq(subscriptions.websiteId, websites.id))
    .leftJoin(subscriptionTiers, eq(subscriptionTiers.id, subscriptions.tierId))
    .orderBy(websites.name);

  // Unread inbound emails per client, with the thread of the newest one.
  const unread = await db
    .select({
      clientId: emailThreads.clientId,
      threadId: emailThreads.id,
      n: count(),
      last: sql<Date>`max(${emails.receivedAt})`,
    })
    .from(emails)
    .innerJoin(emailThreads, eq(emailThreads.id, emails.threadId))
    .where(
      and(eq(emails.direction, "inbound"), isNull(emails.readAt), sql`${emailThreads.clientId} is not null`),
    )
    .groupBy(emailThreads.clientId, emailThreads.id);
  const unreadByClient = new Map<string, { n: number; threadId: string; last: number }>();
  for (const u of unread) {
    const cur = unreadByClient.get(u.clientId!);
    const last = new Date(u.last).getTime();
    unreadByClient.set(u.clientId!, {
      n: (cur?.n ?? 0) + u.n,
      threadId: !cur || last > cur.last ? u.threadId : cur.threadId,
      last: Math.max(last, cur?.last ?? 0),
    });
  }

  return rows.map((r) => {
    const u = unreadByClient.get(r.clientId);
    return {
      id: r.id,
      name: r.name,
      domain: r.domain,
      status: r.status,
      liveUrl: r.liveUrl,
      previewUrl: r.previewUrl,
      clientId: r.clientId,
      clientName: r.clientName,
      subscription:
        r.subPrice !== null
          ? {
              name: r.subName!,
              tierName: r.tierName,
              priceHalere: r.subPrice,
              paidUntil: r.subPaidUntil!,
              status: r.subStatus!,
            }
          : null,
      unreadCount: u?.n ?? 0,
      unreadThreadId: u?.threadId ?? null,
    };
  });
}

export async function getTimeline(limit = 30) {
  await requireAdmin();
  return db
    .select({
      id: subscriptionEvents.id,
      type: subscriptionEvents.type,
      occurredAt: subscriptionEvents.occurredAt,
      amountHalere: subscriptionEvents.amountHalere,
      fromPriceHalere: subscriptionEvents.fromPriceHalere,
      toPriceHalere: subscriptionEvents.toPriceHalere,
      paidUntil: subscriptionEvents.paidUntil,
      note: subscriptionEvents.note,
      clientName: clients.businessName,
      subscriptionName: subscriptions.name,
    })
    .from(subscriptionEvents)
    .innerJoin(clients, eq(clients.id, subscriptionEvents.clientId))
    .innerJoin(subscriptions, eq(subscriptions.id, subscriptionEvents.subscriptionId))
    .orderBy(desc(subscriptionEvents.occurredAt))
    .limit(limit);
}

export type { RevenuePoint };

/** Recorded payments summed per month (last 12 months, zero-filled) and per year (Europe/Prague). */
export async function getRevenue(at?: Date): Promise<{ monthly: RevenuePoint[]; yearly: RevenuePoint[] }> {
  await requireAdmin();
  const now = at ?? new Date();
  const local = sql`(${subscriptionEvents.occurredAt} AT TIME ZONE 'Europe/Prague')`;
  const [monthlyRows, yearlyRows] = await Promise.all([
    db
      .select({
        period: sql<string>`to_char(${local}, 'YYYY-MM')`,
        amount: sum(subscriptionEvents.amountHalere).mapWith(Number),
      })
      .from(subscriptionEvents)
      .where(
        and(
          eq(subscriptionEvents.type, "payment_received"),
          gte(subscriptionEvents.occurredAt, new Date(now.getTime() - 400 * DAY)),
        ),
      )
      .groupBy(sql`1`),
    db
      .select({
        period: sql<string>`to_char(${local}, 'YYYY')`,
        amount: sum(subscriptionEvents.amountHalere).mapWith(Number),
      })
      .from(subscriptionEvents)
      .where(eq(subscriptionEvents.type, "payment_received"))
      .groupBy(sql`1`)
      .orderBy(sql`1`),
  ]);
  return {
    monthly: fillMonths(monthlyRows, now),
    yearly: yearlyRows.map((r) => ({ period: r.period, amountHalere: r.amount ?? 0 })),
  };
}
