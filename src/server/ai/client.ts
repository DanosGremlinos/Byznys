import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export const AI_MODEL = "claude-opus-5-5";

let client: Anthropic | null = null;

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Chybí ANTHROPIC_API_KEY");
  client ??= new Anthropic();
  return client;
}

/** Single text completion with server-side refusal fallback; returns the text or throws. */
export async function completeText(opts: {
  system: string;
  user: string;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<string> {
  const response = await getAnthropic().beta.messages.create({
    model: AI_MODEL,
    max_tokens: opts.maxTokens ?? 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: opts.effort ?? "low" },
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });
  if (response.stop_reason === "refusal") throw new Error("Model odmítl odpovědět.");
  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  if (!text) throw new Error("Prázdná odpověď modelu.");
  return text;
}
