import "server-only";
import { and, asc, desc, eq, gte, ilike, isNotNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { builderProjects, jobs, leadPhotos, leadReviews, leadSiteAnalyses, leads } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-guard";

export type LeadFilters = {
  q?: string;
  city?: string;
  category?: string;
  status?: string;
  minScore?: number;
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
