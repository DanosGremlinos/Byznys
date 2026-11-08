"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth-guard";
import { createJob, kickJob } from "@/server/jobs";
import { rescoreLeads } from "@/server/leads/pipeline";

const searchSchema = z.object({
  category: z.string().trim().min(2, "Zadejte kategorii").max(80),
  city: z.string().trim().min(2, "Zadejte město nebo oblast").max(80),
});

export type SearchState = { error?: string; ok?: string };

export async function startLeadSearch(_prev: SearchState, formData: FormData): Promise<SearchState> {
  await requireAdmin();
  const parsed = searchSchema.safeParse({ category: formData.get("category"), city: formData.get("city") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    return { error: "Chybí GOOGLE_PLACES_API_KEY – vyhledávání zatím nelze spustit." };
  }
  const job = await createJob(
    "lead_search",
    parsed.data,
    `Ve frontě: ${parsed.data.category}, ${parsed.data.city}`,
  );
  kickJob(job.id);
  refresh();
  return { ok: `Vyhledávání „${parsed.data.category}, ${parsed.data.city}“ běží na pozadí.` };
}

export async function reanalyzeLead(leadId: string) {
  await requireAdmin();
  const job = await createJob("site_analysis", { leadIds: [leadId] }, "Ve frontě: analýza webu");
  kickJob(job.id);
  refresh();
}

export async function rescoreAll() {
  await requireAdmin();
  await rescoreLeads();
  refresh();
}

export async function goToBuilderFromLead(leadId: string) {
  await requireAdmin();
  const { createProjectFromLead } = await import("@/server/builder/projects");
  const projectId = await createProjectFromLead(leadId);
  redirect(`/builder/${projectId}`);
}

export async function explainScore(leadId: string): Promise<{ text?: string; error?: string }> {
  await requireAdmin();
  const { aiConfigured } = await import("@/server/ai/client");
  if (!aiConfigured()) return { error: "Chybí ANTHROPIC_API_KEY – vysvětlení zatím nelze vygenerovat." };
  const { db } = await import("@/db");
  const { explainLeadScore } = await import("@/server/ai/explain-score");
  const lead = await db.query.leads.findFirst({ where: (l, { eq }) => eq(l.id, leadId) });
  if (!lead) return { error: "Lead nenalezen" };
  try {
    return { text: await explainLeadScore(lead) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Vysvětlení se nepodařilo vygenerovat." };
  }
}

const consentSchema = z.string().trim().min(3, "Popište, jak jste souhlas získali").max(500);

/** Records the lead's consent to commercial email (zák. č. 480/2004 Sb.), e.g. after a phone call. */
export async function recordLeadConsent(leadId: string, formData: FormData) {
  await requireAdmin();
  const note = consentSchema.safeParse(formData.get("note"));
  if (!note.success)
    redirect(`/leads/${leadId}?consentError=${encodeURIComponent(note.error.issues[0].message)}`);
  const { db } = await import("@/db");
  const { recordConsent } = await import("@/server/leads/privacy");
  await recordConsent(db, leadId, note.data);
  refresh();
}

export async function revokeLeadConsent(leadId: string) {
  await requireAdmin();
  const { db } = await import("@/db");
  const { revokeConsent } = await import("@/server/leads/privacy");
  await revokeConsent(db, leadId);
  refresh();
}

/** GDPR erasure (or objection): deletes the lead; optionally keeps the address on the blacklist. */
export async function eraseLeadAction(leadId: string, formData: FormData) {
  await requireAdmin();
  if (formData.get("confirm") !== "on") {
    redirect(`/leads/${leadId}?consentError=${encodeURIComponent("Potvrďte výmaz zaškrtnutím.")}`);
  }
  const { db } = await import("@/db");
  const { eraseLead } = await import("@/server/leads/privacy");
  await eraseLead(db, leadId, { blacklist: formData.get("blacklist") === "on" });
  redirect("/leads");
}
