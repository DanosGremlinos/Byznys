"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { requireAdmin } from "@/lib/auth-guard";
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
