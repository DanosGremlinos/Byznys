import "server-only";
import { and, count, desc, eq, inArray, isNotNull, isNull, max, or } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  builderProjects,
  builderPromptVersions,
  contracts,
  emailThreads,
  emails,
  packageOffers,
  subscriptionEvents,
  websites,
} from "@/db/schema";
import { pragueToday } from "@/lib/format";
import { jobStage, relevantSentKinds, type SentOfferKind } from "@/lib/job-stage";

const PIPELINE_KINDS = ["offer_l1", "offer_l2", "offer_budget", "offer_l3"] as const;

/** Offer email kinds already sent (with the last send time), per client — for the job stage. */
export async function sentOfferKindsByClient(db: Database, clientIds?: string[]) {
  const map = new Map<string, SentOfferKind[]>();
  if (clientIds && !clientIds.length) return map;
  const rows = await db
    .select({ clientId: emailThreads.clientId, kind: emails.kind, lastSentAt: max(emails.sentAt) })
    .from(emails)
    .innerJoin(emailThreads, eq(emailThreads.id, emails.threadId))
    .where(
      and(
        eq(emails.direction, "outbound"),
        eq(emails.status, "sent"),
        inArray(emails.kind, [...PIPELINE_KINDS]),
        isNotNull(emailThreads.clientId),
        clientIds ? inArray(emailThreads.clientId, clientIds) : undefined,
      ),
    )
    .groupBy(emailThreads.clientId, emails.kind);
  for (const r of rows)
    if (r.clientId && r.kind)
      map.set(r.clientId, [
        ...(map.get(r.clientId) ?? []),
        { kind: r.kind, lastSentAt: r.lastSentAt ? new Date(r.lastSentAt) : new Date(0) },
      ]);
  return map;
}

/** Which jobs (and clients, for offers saved without a job) have calculated packages. */
export async function packageOfferPresence(db: Database) {
  const rows = await db
    .selectDistinct({ clientId: packageOffers.clientId, websiteId: packageOffers.websiteId })
    .from(packageOffers);
  return {
    websites: new Set(rows.map((r) => r.websiteId).filter((x): x is string => !!x)),
    clientsWithoutJob: new Set(rows.filter((r) => !r.websiteId).map((r) => r.clientId)),
  };
}

/** Everything about one job (zakázka = website) for its detail page. */
export async function getJobDetail(db: Database, websiteId: string) {
  const website = await db.query.websites.findFirst({
    where: eq(websites.id, websiteId),
    with: {
      client: { with: { lead: { columns: { id: true, name: true, score: true } } } },
      subscription: {
        with: { events: { orderBy: desc(subscriptionEvents.occurredAt), limit: 20 } },
      },
      builderProjects: {
        orderBy: desc(builderProjects.updatedAt),
        with: {
          promptVersions: {
            columns: { version: true, createdAt: true },
            orderBy: desc(builderPromptVersions.version),
            limit: 1,
          },
        },
      },
    },
  });
  if (!website) return null;
  const client = website.client;
  const [threads, contractRows, offers, sentKinds, [jobCount]] = await Promise.all([
    db.query.emailThreads.findMany({
      where: client.leadId
        ? or(eq(emailThreads.clientId, client.id), eq(emailThreads.leadId, client.leadId))
        : eq(emailThreads.clientId, client.id),
      orderBy: desc(emailThreads.lastMessageAt),
      with: {
        emails: {
          columns: {
            id: true,
            direction: true,
            status: true,
            kind: true,
            subject: true,
            classification: true,
            readAt: true,
            sentAt: true,
            receivedAt: true,
            createdAt: true,
          },
          orderBy: desc(emails.createdAt),
        },
      },
    }),
    db
      .select({ id: contracts.id, title: contracts.title, createdAt: contracts.createdAt })
      .from(contracts)
      .where(
        and(
          eq(contracts.clientId, client.id),
          or(eq(contracts.websiteId, website.id), isNull(contracts.websiteId)),
        ),
      )
      .orderBy(desc(contracts.createdAt)),
    db.query.packageOffers.findMany({
      where: and(
        eq(packageOffers.clientId, client.id),
        or(eq(packageOffers.websiteId, website.id), isNull(packageOffers.websiteId)),
      ),
      orderBy: desc(packageOffers.createdAt),
      with: {
        client: { columns: { id: true, businessName: true } },
        website: { columns: { id: true, name: true, domain: true } },
        email: { columns: { id: true, status: true, sentAt: true } },
        subscription: { columns: { id: true, name: true, priceHalere: true, status: true } },
      },
    }),
    sentOfferKindsByClient(db, [client.id]),
    db.select({ n: count() }).from(websites).where(eq(websites.clientId, client.id)),
  ]);
  const sub = website.subscription;
  const stage = jobStage({
    websiteStatus: website.status,
    subscription: sub ? { status: sub.status, paidUntil: sub.paidUntil } : null,
    sentKinds: relevantSentKinds(sentKinds.get(client.id) ?? [], {
      createdAt: website.createdAt,
      clientHasOtherJobs: jobCount.n > 1,
    }),
    hasPackageOffer: offers.some((o) => o.websiteId === website.id || !o.websiteId),
    today: pragueToday(),
  });
  return { website, client, subscription: sub, threads, contracts: contractRows, offers, stage };
}
