import "server-only";
import { and, asc, desc, eq, gte, ilike, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { builderProjects, jobs, leadPhotos, leadReviews, leadSiteAnalyses, leads } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-guard";

export type LeadFilters = {
  q?: string;
  city?: string;
  category?: string;
  status?: string;
  minScore?: number;
  /** A lead_search job id, "none" for leads without a search, or undefined for all leads. */
  search?: string;
};

const LEAD_STATUSES = ["new", "contacted", "converted", "rejected"] as const;

export async function listLeads(f: LeadFilters) {
  await requireAdmin();
  const where: SQL[] = [];
  if (f.q) where.push(or(ilike(leads.name, `%${f.q}%`), ilike(leads.address, `%${f.q}%`))!);
  if (f.city) where.push(eq(leads.city, f.city));
  if (f.category) where.push(eq(leads.category, f.category));
  if (f.status && (LEAD_STATUSES as readonly string[]).includes(f.status))
    where.push(eq(leads.status, f.status as (typeof LEAD_STATUSES)[number]));
  if (f.minScore) where.push(gte(leads.score, f.minScore));
  if (f.search === "none") where.push(isNull(leads.searchJobId));
  else if (f.search) where.push(eq(leads.searchJobId, f.search));
  return db
    .select({
      id: leads.id,
      name: leads.name,
      category: leads.category,
      city: leads.city,
      websiteUrl: leads.websiteUrl,
      rating: leads.rating,
      reviewCount: leads.reviewCount,
      status: leads.status,
      score: leads.score,
      scoreFactors: leads.scoreFactors,
      email: leads.email,
      phone: leads.phone,
    })
    .from(leads)
    .where(where.length ? and(...where) : undefined)
    .orderBy(sql`${leads.score} desc nulls last`, asc(leads.name))
    .limit(500);
}

export type SearchGroup = {
  id: string;
  category: string;
  city: string;
  createdAt: Date;
  status: string;
  leadCount: number;
};

/** Lead searches, newest first, with how many leads currently belong to each (a lead belongs to the last search that found it). */
export async function listSearchGroups(): Promise<{ groups: SearchGroup[]; withoutSearch: number; total: number }> {
  await requireAdmin();
  const [groups, [counts]] = await Promise.all([
    db
      .select({
        id: jobs.id,
        params: jobs.params,
        createdAt: jobs.createdAt,
        status: jobs.status,
        leadCount: sql<number>`count(${leads.id})::int`,
      })
      .from(jobs)
      .leftJoin(leads, eq(leads.searchJobId, jobs.id))
      .where(eq(jobs.type, "lead_search"))
      .groupBy(jobs.id)
      .orderBy(desc(jobs.createdAt)),
    db
      .select({
        total: sql<number>`count(*)::int`,
        withoutSearch: sql<number>`count(*) filter (where ${leads.searchJobId} is null)::int`,
      })
      .from(leads),
  ]);
  return {
    groups: groups
      // Searches that failed before finding anything are just noise in the list.
      .filter((g) => g.leadCount > 0 || g.status === "queued" || g.status === "running")
      .map((g) => {
        const p = (g.params ?? {}) as { category?: string; city?: string };
        return {
          id: g.id,
          category: p.category ?? "?",
          city: p.city ?? "?",
          createdAt: g.createdAt,
          status: g.status,
          leadCount: g.leadCount,
        };
      }),
    withoutSearch: counts?.withoutSearch ?? 0,
    total: counts?.total ?? 0,
  };
}

export async function leadFilterOptions() {
  await requireAdmin();
  const [cities, categories] = await Promise.all([
    db.selectDistinct({ v: leads.city }).from(leads).where(isNotNull(leads.city)).orderBy(asc(leads.city)),
    db
      .selectDistinct({ v: leads.category })
      .from(leads)
      .where(isNotNull(leads.category))
      .orderBy(asc(leads.category)),
  ]);
  return { cities: cities.map((r) => r.v!), categories: categories.map((r) => r.v!) };
}

export async function getLead(id: string) {
  await requireAdmin();
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, id) });
  if (!lead) return null;
  const [photos, reviews, analyses, projects] = await Promise.all([
    db.select().from(leadPhotos).where(eq(leadPhotos.leadId, id)).orderBy(asc(leadPhotos.sortOrder)),
    db.select().from(leadReviews).where(eq(leadReviews.leadId, id)).orderBy(desc(leadReviews.rating)),
    db
      .select()
      .from(leadSiteAnalyses)
      .where(eq(leadSiteAnalyses.leadId, id))
      .orderBy(desc(leadSiteAnalyses.fetchedAt))
      .limit(1),
    db
      .select({ id: builderProjects.id, name: builderProjects.name })
      .from(builderProjects)
      .where(eq(builderProjects.leadId, id)),
  ]);
  return { lead, photos, reviews, analysis: analyses[0] ?? null, projects };
}

export async function recentJobs(limit = 6) {
  await requireAdmin();
  return db
    .select()
    .from(jobs)
    .where(sql`${jobs.type} <> 'dunning_run'`)
    .orderBy(desc(jobs.createdAt))
    .limit(limit);
}
