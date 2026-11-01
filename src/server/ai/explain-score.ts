import "server-only";
import { SCORE_FACTOR_LABELS, type ScoreFactorKey } from "@/config/scoring";
import type { leads } from "@/db/schema";
import { completeText } from "./client";

type Lead = typeof leads.$inferSelect;

const SYSTEM = `Jsi obchodní asistent malé české firmy, která tvoří weby pro místní podniky a prodává je na měsíční předplatné.
Dostaneš data o potenciálním klientovi a rozpad jeho skóre příležitosti (0–100) na jednotlivé faktory.
Vysvětli majiteli firmy česky, srozumitelně a stručně (nejvýše 5 vět, bez nadpisů a odrážek):
- proč má lead toto skóre (opírej se jen o uvedené faktory a data, nic si nedomýšlej),
- jaký je nejsilnější argument pro oslovení,
- na co si dát pozor.`;

export async function explainLeadScore(lead: Lead): Promise<string> {
  const factors = (lead.scoreFactors ?? []).map((f) => ({
    faktor: SCORE_FACTOR_LABELS[f.key as ScoreFactorKey] ?? f.key,
    splněn: f.fired,
    body: f.points,
    váha: f.weight,
    důvod: f.detail ?? null,
  }));
  const data = {
    název: lead.name,
    obor: lead.category,
    město: lead.city,
    web: lead.websiteUrl,
    hodnocení: lead.rating,
    počet_recenzí: lead.reviewCount,
    skóre: lead.score,
    faktory: factors,
  };
  return completeText({
    system: SYSTEM,
    user: JSON.stringify(data, null, 2),
    effort: "low",
    maxTokens: 2000,
  });
}
