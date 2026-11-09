import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { SCORE_FACTOR_LABELS, type ScoreFactorKey } from "@/config/scoring";
import type { leads } from "@/db/schema";

type Lead = typeof leads.$inferSelect;

/** Fills /prompts/lead-research.md with what is known about the lead. */
export function renderResearchPrompt(template: string, lead: Lead): string {
  const issues = (lead.scoreFactors ?? [])
    .filter((f) => f.fired)
    .map((f) => `${SCORE_FACTOR_LABELS[f.key as ScoreFactorKey] ?? f.key}${f.detail ? ` (${f.detail})` : ""}`)
    .join("; ");
  const values: Record<string, string> = {
    name: lead.name,
    category: lead.category ?? "neuvedeno",
    address: lead.address ?? "neuvedeno",
    phone: lead.phone ?? "neuvedeno",
    email: lead.email ?? "neuvedeno",
    website: lead.websiteUrl ?? "nemá web",
    googleMapsUrl: lead.googleMapsUrl ?? "neuvedeno",
    rating: lead.rating?.toLocaleString("cs-CZ") ?? "–",
    reviewCount: String(lead.reviewCount ?? 0),
    socialLinks: Object.values(lead.socialLinks ?? {}).join(", ") || "nenalezeny",
    contactPerson: lead.contactPerson ?? "neznámá",
    score: lead.score === null ? "–" : String(lead.score),
    issues: issues || "žádné zjištěné",
  };
  return template.replace(/\{\{(\w+)\}\}/g, (m, key: string) => values[key] ?? m);
}

export async function loadResearchTemplate(): Promise<string> {
  return readFile(path.join(process.cwd(), "prompts", "lead-research.md"), "utf8");
}
