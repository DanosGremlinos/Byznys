import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { leadPhotos, leadReviews, leadSiteAnalyses, leads } from "@/db/schema";
import { registerJobHandler, type JobContext } from "@/server/jobs/runner";
import { persistPhoto } from "./photo-store";
import { mapPlaceToLead, mapReviews, resolvePhotoUrl, searchPlaces } from "./places";
import { computeScore } from "./scoring";
import { analyzeHtml, fetchSite, runPagespeed } from "./site-analyzer";

const PHOTOS_PER_LEAD = 4;
const ANALYSIS_CONCURRENCY = 3;

type PipelineState = {
  stage: "search" | "analyze";
  leadIds: string[];
  cursor: number;
  /** Place photo resource names per lead, resolved during analysis. */
  photoNames: Record<string, { name: string; attribution?: string; width?: number; height?: number }[]>;
  found: number;
  newLeads: number;
  analysed: number;
  siteErrors: number;
};

function stateOf(ctx: JobContext): PipelineState {
  const r = (ctx.job.result ?? {}) as Partial<PipelineState>;
  const p = ctx.job.params as { leadIds?: string[] };
  return {
    stage: r.stage ?? (ctx.job.type === "site_analysis" ? "analyze" : "search"),
    leadIds: r.leadIds ?? p.leadIds ?? [],
    cursor: r.cursor ?? 0,
    photoNames: r.photoNames ?? {},
    found: r.found ?? 0,
    newLeads: r.newLeads ?? 0,
    analysed: r.analysed ?? 0,
    siteErrors: r.siteErrors ?? 0,
  };
}

async function searchStage(ctx: JobContext, s: PipelineState) {
  const { category, city } = ctx.job.params as { category: string; city: string };
  await ctx.save(s, { done: 0, total: 0, message: `Hledám „${category}“ v lokalitě ${city}…` });
  const places = await searchPlaces(`${category} ${city}`);
  s.found = places.length;
  let skipped = 0;
  for (const place of places) {
    try {
      const data = mapPlaceToLead(place, category);
      const [row] = await db
        .insert(leads)
        .values({ ...data, searchJobId: ctx.job.id })
        .onConflictDoUpdate({
          target: leads.placeId,
          // Refresh Google data but keep pipeline status, notes and anything found on their website.
          set: {
            name: data.name,
            address: data.address,
            city: data.city,
            lat: data.lat,
            lng: data.lng,
            phone: sql`coalesce(${leads.phone}, excluded.phone)`,
            websiteUrl: data.websiteUrl,
            googleMapsUrl: data.googleMapsUrl,
            openingHours: data.openingHours,
            rating: data.rating,
            reviewCount: data.reviewCount,
          },
        })
        .returning({ id: leads.id, inserted: sql<boolean>`(xmax = 0)` });
      if (row.inserted) s.newLeads++;
      const reviews = mapReviews(place);
      if (reviews.length) {
        await db.delete(leadReviews).where(eq(leadReviews.leadId, row.id));
        await db.insert(leadReviews).values(reviews.map((r) => ({ ...r, leadId: row.id })));
      }
      s.photoNames[row.id] = (place.photos ?? []).slice(0, PHOTOS_PER_LEAD).map((p) => ({
        name: p.name,
        attribution: p.authorAttributions?.[0]?.displayName,
        width: p.widthPx,
        height: p.heightPx,
      }));
      s.leadIds.push(row.id);
    } catch (err) {
      // One malformed place must not stop the whole search.
      skipped++;
      console.error(`[lead_search] skipped place ${place.id}: ${err instanceof Error ? err.message : err}`);
    }
  }
  if (skipped) s.found -= skipped;
  s.stage = "analyze";
  await ctx.save(s, {
    done: 0,
    total: s.leadIds.length,
    message: `Nalezeno ${s.found} podniků, analyzuji weby…`,
  });
}

/** Fetches photos, analyses the website and recomputes the score of one lead. */
export async function analyzeLead(leadId: string, photoNames: PipelineState["photoNames"][string] = []) {
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, leadId) });
  if (!lead) return { siteError: false };

  if (photoNames.length) {
    // Resolve Google's temporary photo URL, then copy it to our Blob storage so it stays usable.
    const urls = await Promise.all(
      photoNames.map(async (p, i) => {
        const temp = await resolvePhotoUrl(p.name).catch(() => null);
        return temp ? (await persistPhoto(temp, `leads/${leadId}/photo-${i + 1}`)).url : null;
      }),
    );
    const rows = photoNames
      .map((p, i) => ({ p, url: urls[i] }))
      .filter((x): x is { p: (typeof photoNames)[number]; url: string } => Boolean(x.url))
      .map(({ p, url }, i) => ({
        leadId,
        url,
        source: "google_places",
        attribution: p.attribution ? `Foto: ${p.attribution} (Google Maps)` : "Google Maps",
        width: p.width ?? null,
        height: p.height ?? null,
        sortOrder: i,
      }));
    if (rows.length) {
      await db
        .delete(leadPhotos)
        .where(and(eq(leadPhotos.leadId, leadId), eq(leadPhotos.source, "google_places")));
      await db.insert(leadPhotos).values(rows);
    }
  }

  let siteError = false;
  if (lead.websiteUrl) {
    const fetchedAt = new Date();
    try {
      const [site, mobile, desktop] = await Promise.all([
        fetchSite(lead.websiteUrl),
        runPagespeed(lead.websiteUrl, "mobile").catch(() => null),
        runPagespeed(lead.websiteUrl, "desktop").catch(() => null),
      ]);
      const a = analyzeHtml(site.html, site.finalUrl);
      await db.insert(leadSiteAnalyses).values({
        leadId,
        url: lead.websiteUrl,
        finalUrl: site.finalUrl,
        fetchedAt,
        httpStatus: site.httpStatus,
        isHttps: site.isHttps,
        copyrightYear: a.copyrightYear,
        techSignals: a.techSignals,
        hasTitle: a.hasTitle,
        hasMetaDescription: a.hasMetaDescription,
        hasH1: a.hasH1,
        hasViewportMeta: a.hasViewportMeta,
        pagespeedMobile: mobile,
        pagespeedDesktop: desktop,
        designIssues: a.designIssues,
        raw: { emails: a.emails, servicesFound: a.services.length },
      });
      // Fill in what the website tells us, without overwriting manual edits.
      await db
        .update(leads)
        .set({
          email: lead.email ?? a.emails[0] ?? null,
          socialLinks: { ...a.socialLinks, ...(lead.socialLinks ?? {}) },
          logoUrl: lead.logoUrl ?? a.logoUrl,
          brandColors: lead.brandColors?.length
            ? lead.brandColors
            : a.brandColors.length
              ? a.brandColors
              : null,
          services: lead.services?.length ? lead.services : a.services,
        })
        .where(eq(leads.id, leadId));
    } catch (err) {
      siteError = true;
      await db.insert(leadSiteAnalyses).values({
        leadId,
        url: lead.websiteUrl,
        fetchedAt,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  await rescoreLeads([leadId]);
  return { siteError };
}

async function analyzeStage(ctx: JobContext, s: PipelineState): Promise<boolean> {
  const total = s.leadIds.length;
  while (s.cursor < total) {
    if (ctx.timeUp()) return false;
    const batch = s.leadIds.slice(s.cursor, s.cursor + ANALYSIS_CONCURRENCY);
    const results = await Promise.all(batch.map((id) => analyzeLead(id, s.photoNames[id])));
    for (const id of batch) delete s.photoNames[id];
    s.cursor += batch.length;
    s.analysed += batch.length;
    s.siteErrors += results.filter((r) => r.siteError).length;
    await ctx.save(s, { done: s.cursor, total, message: `Analyzováno ${s.cursor} z ${total}` });
  }
  await ctx.save(s, {
    done: total,
    total,
    message: `Hotovo: ${s.found ? `${s.found} nalezeno, ${s.newLeads} nových, ` : ""}${s.analysed} analyzováno${s.siteErrors ? `, ${s.siteErrors} webů nešlo načíst` : ""}`,
  });
  return true;
}

async function pipeline(ctx: JobContext): Promise<boolean> {
  const s = stateOf(ctx);
  if (s.stage === "search") await searchStage(ctx, s);
  return analyzeStage(ctx, s);
}

registerJobHandler("lead_search", pipeline);
registerJobHandler("site_analysis", pipeline);

/** Recomputes scores from stored data (latest analysis per lead). Pass no IDs for all leads. */
export async function rescoreLeads(leadIds?: string[]) {
  const rows = await db.query.leads.findMany({
    where: leadIds ? inArray(leads.id, leadIds) : undefined,
    columns: { id: true, websiteUrl: true, rating: true, reviewCount: true },
  });
  if (!rows.length) return 0;
  const analyses = await db
    .selectDistinctOn([leadSiteAnalyses.leadId])
    .from(leadSiteAnalyses)
    .where(
      inArray(
        leadSiteAnalyses.leadId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(leadSiteAnalyses.leadId, desc(leadSiteAnalyses.fetchedAt));
  const byLead = new Map(analyses.map((a) => [a.leadId, a]));
  const now = new Date();
  for (const lead of rows) {
    const result = computeScore({ ...lead, analysis: byLead.get(lead.id) ?? null });
    await db
      .update(leads)
      .set({ score: result.score, scoreFactors: result.factors, scoreVersion: result.version, scoredAt: now })
      .where(eq(leads.id, lead.id));
  }
  return rows.length;
}
