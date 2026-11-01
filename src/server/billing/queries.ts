import "server-only";
import { and, asc, desc, eq, ilike, inArray, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  clients,
  dunningRuns,
  dunningSteps,
  jobs,
  subscriptionEvents,
  subscriptionTiers,
  subscriptions,
  websites,
} from "@/db/schema";
import { addDays, daysOverdue } from "@/lib/dates";
import { pragueToday } from "@/lib/format";
import { requireAdmin } from "@/lib/auth-guard";

export async function listTiers() {
  await requireAdmin();
  return db
    .select()
    .from(subscriptionTiers)
    .orderBy(asc(subscriptionTiers.sortOrder), asc(subscriptionTiers.name));
}

export type SubscriptionFilters = { q?: string; status?: string; tier?: string };

export async function listSubscriptions(f: SubscriptionFilters) {
  await requireAdmin();
  const where: SQL[] = [];
  if (f.q)
    where.push(
      or(
        ilike(clients.businessName, `%${f.q}%`),
        ilike(websites.domain, `%${f.q}%`),
        ilike(subscriptions.name, `%${f.q}%`),
      )!,
    );
  if (f.status === "active" || f.status === "paused" || f.status === "cancelled")
    where.push(eq(subscriptions.status, f.status));
  if (f.tier) where.push(eq(subscriptions.name, f.tier));
  return db
    .select({
      id: subscriptions.id,
      name: subscriptions.name,
      priceHalere: subscriptions.priceHalere,
      status: subscriptions.status,
      paidUntil: subscriptions.paidUntil,
      startedOn: subscriptions.startedOn,
      clientId: clients.id,
      clientName: clients.businessName,
      websiteName: websites.name,
      domain: websites.domain,
      websiteStatus: websites.status,
    })
    .from(subscriptions)
    .innerJoin(clients, eq(clients.id, subscriptions.clientId))
    .innerJoin(websites, eq(websites.id, subscriptions.websiteId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(
      sql`case ${subscriptions.status} when 'active' then 0 when 'paused' then 1 else 2 end`,
      asc(subscriptions.paidUntil),
    );
}

/** Active subscriptions whose next payment (paid_until + 1) falls within the next `days` days. */
export async function upcomingRenewals(days = 30) {
  await requireAdmin();
  const today = pragueToday();
  const rows = await listSubscriptions({ status: "active" });
  return rows
    .filter((r) => r.paidUntil >= today && r.paidUntil < addDays(today, days))
    .map((r) => ({ ...r, nextPayment: addDays(r.paidUntil, 1) }))
    .sort((a, b) => (a.paidUntil < b.paidUntil ? -1 : 1));
}

export async function getSubscriptionDetail(id: string) {
  await requireAdmin();
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.id, id),
    with: {
      client: true,
      website: true,
      tier: true,
      events: { orderBy: desc(subscriptionEvents.occurredAt) },
      dunningRuns: {
        orderBy: desc(dunningRuns.startedAt),
        with: { steps: { orderBy: asc(dunningSteps.step) } },
      },
    },
  });
  return sub ?? null;
}

export async function newSubscriptionOptions() {
  await requireAdmin();
  const [clientRows, websiteRows, tiers] = await Promise.all([
    db
      .select({ id: clients.id, name: clients.businessName })
      .from(clients)
      .orderBy(asc(clients.businessName)),
    db
      .select({ id: websites.id, clientId: websites.clientId, name: websites.name, domain: websites.domain })
      .from(websites)
      .leftJoin(subscriptions, eq(subscriptions.websiteId, websites.id))
      .where(isNull(subscriptions.id))
      .orderBy(asc(websites.name)),
    db
      .select()
      .from(subscriptionTiers)
      .where(eq(subscriptionTiers.isActive, true))
      .orderBy(asc(subscriptionTiers.sortOrder)),
  ]);
  return { clients: clientRows, websites: websiteRows, tiers };
}

export type OverdueSort = "days" | "amount" | "client";

export async function listOverdue(opts: { sort: OverdueSort; q?: string; minDays?: number }) {
  await requireAdmin();
  const today = pragueToday();
  const rows = await db
    .select({
      subscriptionId: subscriptions.id,
      name: subscriptions.name,
      priceHalere: subscriptions.priceHalere,
      paidUntil: subscriptions.paidUntil,
      clientId: clients.id,
      clientName: clients.businessName,
      clientEmail: clients.email,
      websiteId: websites.id,
      domain: websites.domain,
      websiteName: websites.name,
      websiteStatus: websites.status,
    })
    .from(subscriptions)
    .innerJoin(clients, eq(clients.id, subscriptions.clientId))
    .innerJoin(websites, eq(websites.id, subscriptions.websiteId))
    .where(
      and(
        eq(subscriptions.status, "active"),
        lt(subscriptions.paidUntil, today),
        opts.q
          ? or(ilike(clients.businessName, `%${opts.q}%`), ilike(websites.domain, `%${opts.q}%`))
          : undefined,
      ),
    );
  const runs = rows.length
    ? await db.query.dunningRuns.findMany({
        where: inArray(
          dunningRuns.subscriptionId,
          rows.map((r) => r.subscriptionId),
        ),
        with: { steps: { orderBy: asc(dunningSteps.step) } },
        orderBy: desc(dunningRuns.startedAt),
      })
    : [];
  const items = rows
    .map((r) => {
      const run =
        runs.find((x) => x.subscriptionId === r.subscriptionId && x.missedPaidUntil === r.paidUntil) ?? null;
      return { ...r, daysOverdue: daysOverdue(r.paidUntil, today), dueDate: addDays(r.paidUntil, 1), run };
    })
    .filter((r) => !opts.minDays || r.daysOverdue >= opts.minDays);
  items.sort((a, b) =>
    opts.sort === "amount"
      ? b.priceHalere - a.priceHalere
      : opts.sort === "client"
        ? a.clientName.localeCompare(b.clientName, "cs")
        : b.daysOverdue - a.daysOverdue,
  );
  return items;
}

export async function lastDunningJobs(limit = 3) {
  await requireAdmin();
  return db
    .select()
    .from(jobs)
    .where(eq(jobs.type, "dunning_run"))
    .orderBy(desc(jobs.createdAt))
    .limit(limit);
}
