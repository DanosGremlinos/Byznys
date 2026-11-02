"use server";

import { del } from "@vercel/blob";
import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { BUILDER_TEMPLATES } from "@/config/builder";
import { db } from "@/db";
import { builderAssets, builderProjects } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-guard";
import { blobEnabled } from "@/lib/blob-config";
import {
  createBlankProject,
  createProjectFromWebsite,
  generatePromptVersion,
} from "@/server/builder/projects";

const opt = z.string().trim().max(2000).optional();
const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

const projectSchema = z.object({
  name: z.string().trim().min(1).max(200),
  clientInfo: z.object({
    businessName: opt,
    category: opt,
    contactPerson: opt,
    email: opt,
    phone: opt,
    address: opt,
    city: opt,
    domain: opt,
    currentWebsite: opt,
    notes: opt,
    openingHours: z
      .partialRecord(
        z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
        z.array(z.object({ open: z.string(), close: z.string() })),
      )
      .optional(),
    services: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(200),
          description: z.string().max(500).optional(),
          priceHalere: z.number().int().nonnegative().optional(),
          priceText: z.string().max(100).optional(),
          category: z.string().max(100).optional(),
        }),
      )
      .max(200)
      .optional(),
    socialLinks: z.record(z.string(), z.string().max(500)).optional(),
  }),
  structure: z.object({
    mode: z.enum(["one-page", "multi-page"]),
    pages: z.array(z.string().max(40)).max(20),
    sections: z.array(z.string().max(40)).max(30),
    extras: z.array(z.string().max(40)).max(10),
  }),
  style: z.object({
    template: z.enum(BUILDER_TEMPLATES.map((t) => t.key) as [string, ...string[]]).optional(),
    palette: z.array(hex).max(8).optional(),
    paletteSource: z.enum(["logo", "manual"]).optional(),
    fonts: z
      .object({ heading: z.string().max(60).optional(), body: z.string().max(60).optional() })
      .optional(),
    mood: z.array(z.string().max(40)).max(10).optional(),
    referenceUrls: z.array(z.string().url().max(500)).max(10).optional(),
  }),
  customInstructions: z.string().max(10_000).nullable(),
  assets: z
    .array(
      z.object({
        id: z.string().uuid(),
        sortOrder: z.number().int(),
        isHero: z.boolean(),
        isSelected: z.boolean(),
      }),
    )
    .max(500),
});

export type ProjectPayload = z.infer<typeof projectSchema>;
export type SaveResult = { ok: boolean; error?: string; prompt?: { version: number; content: string } };

async function save(projectId: string, payload: unknown): Promise<string | null> {
  const parsed = projectSchema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return `Neplatná data (${issue?.path.join(".")}): ${issue?.message}`;
  }
  const { assets, style, ...rest } = parsed.data;
  await db.transaction(async (tx) => {
    await tx
      .update(builderProjects)
      .set({ ...rest, style: style as typeof builderProjects.$inferInsert.style })
      .where(eq(builderProjects.id, projectId));
    for (const a of assets) {
      await tx
        .update(builderAssets)
        .set({ sortOrder: a.sortOrder, isHero: a.isHero, isSelected: a.isSelected })
        .where(and(eq(builderAssets.id, a.id), eq(builderAssets.projectId, projectId)));
    }
  });
  return null;
}

export async function saveProject(projectId: string, payload: unknown): Promise<SaveResult> {
  await requireAdmin();
  const error = await save(projectId, payload);
  return error ? { ok: false, error } : { ok: true };
}

/** "Vygenerovat prompt": saves the form and stores a new prompt version. */
export async function saveAndGeneratePrompt(projectId: string, payload: unknown): Promise<SaveResult> {
  await requireAdmin();
  const error = await save(projectId, payload);
  if (error) return { ok: false, error };
  const version = await generatePromptVersion(projectId);
  refresh();
  return { ok: true, prompt: { version: version.version, content: version.content } };
}

export async function newBlankProject() {
  await requireAdmin();
  redirect(`/builder/${await createBlankProject()}`);
}

export async function openWebsiteInBuilder(websiteId: string) {
  await requireAdmin();
  redirect(`/builder/${await createProjectFromWebsite(websiteId)}`);
}

const uploadedSchema = z.object({
  url: z.string().url().startsWith("https://"),
  pathname: z.string().max(500),
  filename: z.string().max(300),
  contentType: z.string().max(100),
  kind: z.enum(["photo", "logo", "document"]),
});

export async function addUploadedAsset(projectId: string, input: unknown) {
  await requireAdmin();
  const data = uploadedSchema.parse(input);
  const [row] = await db
    .insert(builderAssets)
    .values({
      projectId,
      kind: data.kind,
      source: "upload",
      url: data.url,
      blobPathname: data.pathname,
      filename: data.filename,
      contentType: data.contentType,
      sortOrder: 1000,
    })
    .returning();
  refresh();
  return row;
}

export async function deleteUploadedAsset(projectId: string, assetId: string) {
  await requireAdmin();
  const asset = await db.query.builderAssets.findFirst({
    where: and(eq(builderAssets.id, assetId), eq(builderAssets.projectId, projectId)),
  });
  if (!asset || asset.source !== "upload") return;
  if (asset.url && blobEnabled()) await del(asset.url).catch(() => {});
  await db.delete(builderAssets).where(eq(builderAssets.id, assetId));
  refresh();
}
