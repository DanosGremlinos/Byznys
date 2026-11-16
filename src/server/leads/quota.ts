import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { leadSearchDailyLimit } from "@/config/limits";
import type { Database } from "@/db/client";
import { jobs } from "@/db/schema";

/** Midnight today in Europe/Prague, as a timestamp. */
const startOfPragueDay = sql<Date>`(date_trunc('day', now() at time zone 'Europe/Prague') at time zone 'Europe/Prague')`;

const todaysSearches = and(eq(jobs.type, "lead_search"), gte(jobs.createdAt, startOfPragueDay));

export async function leadSearchQuota(db: Database): Promise<{ used: number; limit: number; remaining: number }> {
  const limit = leadSearchDailyLimit();
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(jobs).where(todaysSearches);
  const used = row?.n ?? 0;
  return { used, limit, remaining: Math.max(0, limit - used) };
}

/**
 * Creates a lead_search job unless today's limit is used up. Checking and inserting happen under a
 * transaction-level advisory lock, so two clicks at once cannot both slip past the limit.
 * Every started search counts (a failed one may already have called Google).
 */
export async function reserveLeadSearch(
  db: Database,
  params: { category: string; city: string },
  message: string,
): Promise<{ jobId: string } | { error: string }> {
  const limit = leadSearchDailyLimit();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('lead_search_daily_quota'))`);
    const [row] = await tx.select({ n: sql<number>`count(*)::int` }).from(jobs).where(todaysSearches);
    if ((row?.n ?? 0) >= limit) {
      return {
        error:
          limit === 0
            ? "Vyhledávání leadů je vypnuté (LEAD_SEARCH_DAILY_LIMIT=0)."
            : `Dnešní limit ${limit} vyhledávání je vyčerpaný. Další půjde zítra.`,
      };
    }
    const [job] = await tx
      .insert(jobs)
      .values({ type: "lead_search", params, progress: { done: 0, total: 0, message } })
      .returning({ id: jobs.id });
    return { jobId: job.id };
  });
}
