"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { requireAdmin } from "@/lib/auth-guard";
import {
  cancelSubscription,
  changePackage,
  createSubscription,
  recordPayment,
  setSubscriptionPaused,
  setWebsiteSuspended,
} from "@/server/billing/subscriptions";

export type FormState = { ok?: string; error?: string };

const czk = z
  .string()
  .trim()
  .transform((v) => Number(v.replace(/\s/g, "").replace(",", ".")))
  .refine((n) => Number.isFinite(n) && n > 0, "Zadejte kladnou částku v Kč")
  .transform((n) => Math.round(n * 100));
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Neplatné datum");
const features = z
  .string()
  .optional()
  .transform((v) =>
    (v ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
  );

const newSchema = z.object({
  clientId: z.string().uuid("Vyberte klienta"),
  websiteId: z.string().optional(),
  newWebsiteName: z.string().trim().max(200).optional(),
  newWebsiteDomain: z.string().trim().max(200).optional(),
  tierId: z.string().optional(),
  name: z.string().trim().min(1, "Zadejte název balíčku").max(200),
  price: czk,
  features,
  startedOn: date,
  paidUntil: date,
});

export async function createSubscriptionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = newSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;
  let id: string;
  try {
    const sub = await createSubscription(db, {
      clientId: d.clientId,
      websiteId: d.websiteId && d.websiteId !== "new" ? d.websiteId : null,
      newWebsite:
        d.websiteId === "new" || !d.websiteId
          ? { name: d.newWebsiteName ?? "", domain: d.newWebsiteDomain }
          : null,
      tierId: d.tierId || null,
      name: d.name,
      priceHalere: d.price,
      features: d.features,
      startedOn: d.startedOn,
      paidUntil: d.paidUntil,
    });
    id = sub.id;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Předplatné se nepodařilo vytvořit." };
  }
  redirect(`/subscriptions/${id}`);
}

const paymentSchema = z.object({
  months: z.coerce.number().int().min(1, "Alespoň 1 měsíc").max(36),
  amount: czk,
  note: z.string().trim().max(500).optional(),
});

export async function recordPaymentAction(
  subscriptionId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  try {
    const r = await recordPayment(db, subscriptionId, {
      months: parsed.data.months,
      amountHalere: parsed.data.amount,
      note: parsed.data.note || null,
    });
    refresh();
    const [y, m, d] = r.paidUntil.split("-").map(Number);
    return {
      ok: `Platba zaznamenána, zaplaceno do ${d}. ${m}. ${y}.${r.stoppedReminders ? " Upomínky byly zastaveny." : ""}`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Platbu se nepodařilo zaznamenat." };
  }
}

const packageSchema = z.object({
  tierId: z.string().optional(),
  name: z.string().trim().min(1, "Zadejte název balíčku").max(200),
  price: czk,
  features,
});

export async function changePackageAction(
  subscriptionId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const parsed = packageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  try {
    await changePackage(db, subscriptionId, {
      tierId: parsed.data.tierId || null,
      name: parsed.data.name,
      priceHalere: parsed.data.price,
      features: parsed.data.features,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Změna se nepodařila." };
  }
  refresh();
  return { ok: "Balíček změněn a zapsán do historie." };
}

export async function cancelSubscriptionAction(
  subscriptionId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "Uveďte důvod zrušení." };
  await cancelSubscription(db, subscriptionId, reason);
  refresh();
  return { ok: "Předplatné zrušeno." };
}

export async function pauseSubscriptionAction(subscriptionId: string, paused: boolean) {
  await requireAdmin();
  await setSubscriptionPaused(db, subscriptionId, paused);
  refresh();
}

export async function suspendWebsiteAction(websiteId: string, suspended: boolean) {
  await requireAdmin();
  await setWebsiteSuspended(db, websiteId, suspended);
  refresh();
}
