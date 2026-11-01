import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { AI_MODEL, getAnthropic } from "./client";

const draftSchema = z.object({ subject: z.string(), body: z.string() });

const DRAFT_SYSTEM = `Jsi obchodní asistent malé české firmy, která tvoří weby pro místní podniky (pizzerie, salony, řemeslníky) a prodává je na měsíční předplatné.
Dostaneš návrh e-mailu vyplněný ze šablony a fakta o adresátovi. Uprav e-mail tak, aby byl osobní, přirozený a krátký (nejvýše cca 150 slov těla, pokud šablona není delší), v češtině, vykat.
Pravidla:
- Používej jen fakta ze vstupu. Nevymýšlej ceny, termíny, slevy, reference ani problémy webu.
- Pokud jsou uvedené konkrétní problémy webu, zmiň 2–3 nejdůležitější lidsky a bez technického žargonu.
- Zachovej všechny odkazy (URL) a částky přesně tak, jak jsou.
- Pokud znáš jméno kontaktní osoby, oslov ji správně v 5. pádě (např. „Dobrý den, pane Nováku,“); jinak „Dobrý den,“.
- Nepřidávej patičku s odhlášením ani podpis navíc – podpis nech ze šablony, odhlašovací odkaz se doplní automaticky.
- Text placeholderů ve tvaru {{nazev}} ponech beze změny.`;

export async function personalizeDraft(input: {
  level: string;
  subject: string;
  body: string;
  facts: Record<string, unknown>;
}): Promise<{ subject: string; body: string }> {
  const response = await getAnthropic().beta.messages.parse({
    model: AI_MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(draftSchema) },
    system: DRAFT_SYSTEM,
    messages: [
      {
        role: "user",
        content: JSON.stringify(
          {
            úroveň_nabídky: input.level,
            šablona: { předmět: input.subject, tělo: input.body },
            fakta: input.facts,
          },
          null,
          2,
        ),
      },
    ],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output)
    throw new Error("AI návrh se nepodařilo vytvořit.");
  return response.parsed_output;
}

export const CLASSIFICATIONS = ["interested", "not_interested", "question", "change_request"] as const;
export type Classification = (typeof CLASSIFICATIONS)[number];

const classifySchema = z.object({
  classification: z.enum(CLASSIFICATIONS),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
});

const CLASSIFY_SYSTEM = `Klasifikuješ odpovědi klientů a potenciálních klientů na e-maily firmy, která tvoří a spravuje weby na předplatné.
Kategorie:
- interested: projevuje zájem, chce pokračovat, ptá se na cenu s úmyslem objednat
- not_interested: odmítá, nemá zájem, chce přestat dostávat zprávy
- question: ptá se na něco (podmínky, cena, technické detaily) bez jasného rozhodnutí
- change_request: žádá úpravu webu, návrhu nebo obsahu (texty, fotky, otevírací doba, barvy)
Vrať kategorii, jistotu 0–1 a krátké zdůvodnění česky (jedna věta).`;

export async function classifyReply(input: { text: string; subject: string; context?: string }) {
  const response = await getAnthropic().beta.messages.parse({
    model: AI_MODEL,
    max_tokens: 1000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(classifySchema) },
    system: CLASSIFY_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Předmět: ${input.subject}\n${input.context ? `Předchozí e-mail od nás: ${input.context}\n` : ""}\nOdpověď:\n${input.text}`,
      },
    ],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) throw new Error("Klasifikace selhala.");
  return response.parsed_output;
}

const REPLY_SYSTEM = `Píšeš odpověď jménem majitele malé české firmy, která tvoří a spravuje weby na předplatné. Odpověz česky, vykej, stručně a věcně na poslední zprávu klienta.
Nevymýšlej ceny, termíny ani sliby, které nejsou v historii konverzace; kde je potřeba doplnit údaj, napiš [DOPLNIT]. Nepřidávej patičku s odhlášením. Vrať jen tělo e-mailu.`;

export async function draftReply(thread: {
  subject: string;
  messages: { from: string; text: string }[];
}): Promise<string> {
  const history = thread.messages.map((m) => `--- ${m.from}:\n${m.text}`).join("\n\n");
  const response = await getAnthropic().beta.messages.create({
    model: AI_MODEL,
    max_tokens: 3000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system: REPLY_SYSTEM,
    messages: [{ role: "user", content: `Předmět: ${thread.subject}\n\n${history}` }],
  });
  if (response.stop_reason === "refusal") throw new Error("AI odpověď se nepodařilo vytvořit.");
  return response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
