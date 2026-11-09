"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { requireAdmin } from "@/lib/auth-guard";
import { deletePackageOffer, savePackageOffer } from "@/server/billing/package-offers";
import { upsertTier } from "@/server/billing/subscriptions";

export type TierState = { ok?: string; error?: string };

const schema = z.object({
  name: z.string().trim().min(1, "Zadejte název").max(100),
  description: z.string().trim().max(500).optional(),
  price: z
    .string()
    .trim()
    .transform((v) => Number(v.replace(/\s/g, "").replace(",", ".")))
    .refine((n) => Number.isFinite(n) && n > 0, "Zadejte kladnou cenu v Kč"),
  features: z.string().optional(),
  sortOrder: z.coerce.number().int().min(0).max(999),
  isActive: z.string().optional(),
});

export async function saveTier(id: string | null, _prev: TierState, formData: FormData): Promise<TierState> {
  await requireAdmin();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;
  try {
    await upsertTier(db, id, {
      name: d.name,
      description: d.description || null,
      monthlyPriceHalere: Math.round(d.price * 100),
      features: (d.features ?? "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      sortOrder: d.sortOrder,
      isActive: d.isActive === "on",
    });
  } catch {
    return { error: "Uložení selhalo (název musí být jedinečný)." };
  }
  refresh();
  return { ok: id ? "Uloženo." : "Šablona balíčku přidána." };
}

export type OfferState = { ok?: string; error?: string; offerId?: string; clientId?: string };

const packageSchema = z.object({
  tierId: z.string().uuid().nullable(),
  name: z.string().trim().min(1, "Každý balíček musí mít název").max(100),
  priceHalere: z.number().int().positive("Každý balíček musí mít kladnou cenu"),
  features: z.array(z.string().max(300)).max(40),
  recommended: z.boolean(),
});

const offerSchema = z.object({
  clientId: z.string().uuid("Vyberte klienta"),
  websiteId: z.union([z.literal(""), z.string().uuid()]).optional(),
  budget: z
    .string()
    .trim()
    .transform((v) => Number(v.replace(/\s/g, "").replace(",", ".")))
    .refine((n) => Number.isFinite(n) && n > 0, "Zadejte rozpočet klienta v Kč"),
  packages: z
    .string()
    .transform((v, ctx) => {
      try {
        return JSON.parse(v) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "Neplatné balíčky" });
        return z.NEVER;
      }
    })
    .pipe(z.array(packageSchema).length(3, "Nabídka musí mít 3 balíčky")),
  note: z.string().trim().max(1000).optional(),
});

export async function savePackageOfferAction(_prev: OfferState, formData: FormData): Promise<OfferState> {
  await requireAdmin();
  const parsed = offerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;
  try {
    const offer = await savePackageOffer(db, {
      clientId: d.clientId,
      websiteId: d.websiteId || null,
      budgetHalere: Math.round(d.budget * 100),
      packages: d.packages,
      note: d.note || null,
    });
    refresh();
    return { ok: "Balíčky uloženy k zakázce.", offerId: offer.id, clientId: offer.clientId };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Uložení selhalo." };
  }
}

/** Deletes saved packages (unwanted or test calculations). */
export async function deletePackageOfferAction(id: string): Promise<OfferState> {
  await requireAdmin();
  try {
    await deletePackageOffer(db, id);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Smazání selhalo." };
  }
  refresh();
  return { ok: "Smazáno." };
}
