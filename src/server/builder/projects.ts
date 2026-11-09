import "server-only";
import { asc, desc, eq, max } from "drizzle-orm";
import { DEFAULT_STRUCTURE } from "@/config/builder";
import { db } from "@/db";
import {
  builderAssets,
  builderProjects,
  builderPromptVersions,
  clients,
  leadPhotos,
  leadReviews,
  leads,
  websites,
} from "@/db/schema";
import type { BuilderClientInfo } from "@/db/schema/types";
import { requireAdmin } from "@/lib/auth-guard";
import { buildSitePrompt } from "./prompt";

type Lead = typeof leads.$inferSelect;

function clientInfoFromLead(lead: Lead): BuilderClientInfo {
  return {
    businessName: lead.name,
    category: lead.category ?? undefined,
    contactPerson: lead.contactPerson ?? undefined,
    email: lead.email ?? undefined,
    phone: lead.phone ?? undefined,
    address: lead.address ?? undefined,
    city: lead.city ?? undefined,
    openingHours: lead.openingHours ?? undefined,
    services: lead.services ?? undefined,
    socialLinks: lead.socialLinks ?? undefined,
    currentWebsite: lead.websiteUrl ?? undefined,
  };
}

/** Copies the lead's photos, logo and reviews into the project's asset panel. */
async function importLeadAssets(projectId: string, lead: Lead) {
  const [photos, reviews] = await Promise.all([
    db.select().from(leadPhotos).where(eq(leadPhotos.leadId, lead.id)).orderBy(asc(leadPhotos.sortOrder)),
    db.select().from(leadReviews).where(eq(leadReviews.leadId, lead.id)).orderBy(desc(leadReviews.rating)),
  ]);
  const rows: (typeof builderAssets.$inferInsert)[] = [
    ...photos.map((p, i) => ({
      projectId,
      kind: "photo" as const,
      source: "scraped" as const,
      url: p.url,
      leadPhotoId: p.id,
      sortOrder: i,
      isHero: i === 0,
    })),
    ...reviews.map((r, i) => ({
      projectId,
      kind: "review" as const,
      source: "scraped" as const,
      leadReviewId: r.id,
      sortOrder: i,
      isSelected: r.rating >= 4 && i < 4,
    })),
  ];
  if (lead.logoUrl)
    rows.push({ projectId, kind: "logo", source: "scraped", url: lead.logoUrl, sortOrder: 0 });
  if (rows.length) await db.insert(builderAssets).values(rows);
}

/** "Postavit web": opens the lead's project (creating it, prefilled, with prompt v1 when new). */
export async function createProjectFromLead(leadId: string): Promise<string> {
  await requireAdmin();
  const existing = await db.query.builderProjects.findFirst({ where: eq(builderProjects.leadId, leadId) });
  if (existing) return existing.id;
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, leadId) });
  if (!lead) throw new Error("Lead nenalezen");
  const [project] = await db
    .insert(builderProjects)
    .values({
      name: `Web – ${lead.name}`,
      leadId,
      clientInfo: clientInfoFromLead(lead),
      structure: DEFAULT_STRUCTURE,
      style: lead.brandColors?.length ? { palette: lead.brandColors, paletteSource: "logo" } : {},
    })
    .returning();
  await importLeadAssets(project.id, lead);
  await generatePromptVersion(project.id);
  return project.id;
}

/** "Otevřít v builderu" from a dashboard website tile. */
export async function createProjectFromWebsite(websiteId: string): Promise<string> {
  await requireAdmin();
  const existing = await db.query.builderProjects.findFirst({
    where: eq(builderProjects.websiteId, websiteId),
    orderBy: desc(builderProjects.updatedAt),
  });
  if (existing) return existing.id;
  const website = await db.query.websites.findFirst({ where: eq(websites.id, websiteId) });
  if (!website) throw new Error("Web nenalezen");
  const client = await db.query.clients.findFirst({ where: eq(clients.id, website.clientId) });
  const lead = client?.leadId
    ? await db.query.leads.findFirst({ where: eq(leads.id, client.leadId) })
    : undefined;
  const info: BuilderClientInfo = {
    ...(lead ? clientInfoFromLead(lead) : {}),
    businessName: client?.businessName ?? website.name,
    contactPerson: client?.contactPerson ?? lead?.contactPerson ?? undefined,
    email: client?.email ?? undefined,
    phone: client?.phone ?? undefined,
    address: client?.address ?? undefined,
    city: client?.city ?? undefined,
    domain: website.domain ?? undefined,
  };
  const [project] = await db
    .insert(builderProjects)
    .values({
      name: `Web – ${website.name}`,
      websiteId,
      leadId: lead?.id ?? null,
      clientInfo: info,
      structure: DEFAULT_STRUCTURE,
      style: lead?.brandColors?.length ? { palette: lead.brandColors, paletteSource: "logo" } : {},
    })
    .returning();
  if (lead) await importLeadAssets(project.id, lead);
  return project.id;
}

export async function createBlankProject(): Promise<string> {
  await requireAdmin();
  const [project] = await db
    .insert(builderProjects)
    .values({ name: "Nový projekt", structure: DEFAULT_STRUCTURE })
    .returning();
  return project.id;
}

export async function listProjects() {
  await requireAdmin();
  return db.query.builderProjects.findMany({
    orderBy: desc(builderProjects.updatedAt),
    with: {
      promptVersions: { columns: { version: true }, orderBy: desc(builderPromptVersions.version), limit: 1 },
    },
  });
}

export async function getProjectForEditor(id: string) {
  await requireAdmin();
  const project = await db.query.builderProjects.findFirst({
    where: eq(builderProjects.id, id),
    with: {
      lead: { columns: { id: true, name: true, rating: true, reviewCount: true } },
      website: { columns: { id: true, name: true, domain: true } },
      assets: {
        orderBy: [asc(builderAssets.sortOrder), asc(builderAssets.createdAt)],
        with: { leadReview: true, leadPhoto: { columns: { attribution: true } } },
      },
      promptVersions: { orderBy: desc(builderPromptVersions.version) },
    },
  });
  return project ?? null;
}

/** Creates the next prompt version from the project's current saved state. */
export async function generatePromptVersion(projectId: string) {
  const project = await db.query.builderProjects.findFirst({
    where: eq(builderProjects.id, projectId),
    with: {
      lead: { columns: { rating: true, reviewCount: true } },
      assets: {
        orderBy: [asc(builderAssets.sortOrder), asc(builderAssets.createdAt)],
        with: { leadReview: true, leadPhoto: { columns: { attribution: true } } },
      },
    },
  });
  if (!project) throw new Error("Projekt nenalezen");
  const selected = project.assets.filter((a) => a.isSelected);
  const photos = selected
    .filter((a) => a.kind === "photo" && a.url)
    .sort((a, b) => Number(b.isHero) - Number(a.isHero))
    .map((a) => ({ url: a.url!, isHero: a.isHero, attribution: a.leadPhoto?.attribution ?? null }));
  const logo = selected.find((a) => a.kind === "logo" && a.url);
  const content = buildSitePrompt({
    projectName: project.name,
    clientInfo: project.clientInfo,
    structure: project.structure,
    style: project.style,
    customInstructions: project.customInstructions,
    photos,
    logoUrl: logo?.url ?? null,
    reviews: selected
      .filter((a) => a.kind === "review" && a.leadReview)
      .map((a) => ({ author: a.leadReview!.author, rating: a.leadReview!.rating, text: a.leadReview!.text })),
    documents: selected
      .filter((a) => a.kind === "document" && a.url)
      .map((a) => ({ url: a.url!, filename: a.filename, contentType: a.contentType })),
    rating: project.lead?.rating,
    reviewCount: project.lead?.reviewCount,
  });
  const [{ value }] = await db
    .select({ value: max(builderPromptVersions.version) })
    .from(builderPromptVersions)
    .where(eq(builderPromptVersions.projectId, projectId));
  const [version] = await db
    .insert(builderPromptVersions)
    .values({ projectId, version: (value ?? 0) + 1, content })
    .returning();
  await db.update(builderProjects).set({ updatedAt: new Date() }).where(eq(builderProjects.id, projectId));
  return version;
}
