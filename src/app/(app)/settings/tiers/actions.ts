"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { requireAdmin } from "@/lib/auth-guard";
import { savePackageOffer } from "@/server/billing/package-offers";
import { deleteService, upsertService } from "@/server/billing/services";

export type ServiceState = { ok?: string; error?: string };

const serviceSchema = z.object({
  name: z.string().trim().min(1, "Zadejte název služby").max(200),
  description: z.string().trim().max(500).optional(),
  price: z
    .string()
    .trim()
    .transform((v) => Number((v || "0").replace(/\s/g, "").replace(",", ".")))
    .refine((n) => Number.isFinite(n) && n >= 0, "Zadejte cenu v Kč (0 nebo víc)"),
  sortOrder: z.coerce.number().int().min(0).max(9999),
  required: z.string().optional(),
  isActive: z.string().optional(),
});

export async function saveService(
  id: string | null,
  _prev: ServiceState,
  formData: FormData,
): Promise<ServiceState> {
  await requireAdmin();
  const parsed = serviceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;
  try {
    await upsertService(db, id, {
      name: d.name,
      description: d.description || null,
      monthlyPriceHalere: Math.round(d.price * 100),
      required: d.required === "on",
      sortOrder: d.sortOrder,
      isActive: d.isActive === "on",
    });
  } catch {
    return { error: "Uložení selhalo (název služby musí být jedinečný)." };
  }
  refresh();
  return { ok: id ? "Uloženo." : "Služba přidána." };
}

export async function removeService(id: string) {
  await requireAdmin();
  await deleteService(db, id);
  refresh();
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
