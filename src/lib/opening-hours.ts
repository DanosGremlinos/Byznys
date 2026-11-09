import type { OpeningHours, Weekday } from "@/db/schema/types";

export const WEEKDAYS: { key: Weekday; label: string }[] = [
  { key: "mon", label: "Pondělí" },
  { key: "tue", label: "Úterý" },
  { key: "wed", label: "Středa" },
  { key: "thu", label: "Čtvrtek" },
  { key: "fri", label: "Pátek" },
  { key: "sat", label: "Sobota" },
  { key: "sun", label: "Neděle" },
];

/** One day as editable text, e.g. "09:00–12:00, 13:00–18:00", "zavřeno", or "" (not specified). */
export function dayToText(slots: { open: string; close: string }[] | undefined): string {
  if (slots === undefined) return "";
  if (slots.length === 0) return "zavřeno";
  return slots.map((s) => `${s.open}–${s.close}`).join(", ");
}

const TIME = /(\d{1,2})[:.](\d{2})/;
const pad = (t: RegExpMatchArray) => `${t[1].padStart(2, "0")}:${t[2]}`;

/** Parses editable text back; returns undefined for empty input and null when it can't be parsed. */
export function textToDay(text: string): { open: string; close: string }[] | undefined | null {
  const t = text.trim().toLowerCase();
  if (!t) return undefined;
  if (/^(zav[řr]eno|closed|-)$/.test(t)) return [];
  const slots: { open: string; close: string }[] = [];
  for (const part of t.split(/[,;]/)) {
    const [a, b] = part.split(/\s*[-–—]\s*/);
    const open = a?.match(TIME);
    const close = b?.match(TIME);
    if (!open || !close) return null;
    slots.push({ open: pad(open), close: pad(close) });
  }
  return slots;
}

export function textsToOpeningHours(texts: Record<Weekday, string>): {
  hours: OpeningHours;
  invalid: Weekday[];
} {
  const hours: OpeningHours = {};
  const invalid: Weekday[] = [];
  for (const { key } of WEEKDAYS) {
    const parsed = textToDay(texts[key] ?? "");
    if (parsed === null) invalid.push(key);
    else if (parsed !== undefined) hours[key] = parsed;
  }
  return { hours, invalid };
}
