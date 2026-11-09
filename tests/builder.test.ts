import { describe, expect, it } from "vitest";
import { dominantColors } from "@/lib/palette";
import { dayToText, textsToOpeningHours, textToDay } from "@/lib/opening-hours";
import { fillMonths } from "@/lib/revenue";
import { buildSitePrompt, type PromptInput } from "@/server/builder/prompt";
import { renderResearchPrompt } from "@/server/leads/research-prompt";

const INPUT: PromptInput = {
  projectName: "Web – Pizzerie Napoli",
  clientInfo: {
    businessName: "Pizzerie Napoli",
    category: "Pizzerie",
    phone: "603 123 456",
    address: "Masarykova 12, 602 00 Brno",
    city: "Brno",
    openingHours: { mon: [{ open: "11:00", close: "22:00" }], sun: [] },
    services: [
      { name: "Margherita", priceHalere: 16900 },
      { name: "Rozvoz", priceText: "od 49 Kč" },
    ],
  },
  structure: {
    mode: "one-page",
    pages: ["home"],
    sections: ["hero", "services", "reviews"],
    extras: ["reservations"],
  },
  style: {
    template: "premium",
    palette: ["#B91C1C", "#111827"],
    paletteSource: "logo",
    fonts: { heading: "Playfair Display", body: "Inter" },
    mood: ["elegant"],
  },
  customInstructions: "Zdůraznit rozvoz.",
  photos: [
    { url: "https://img/2.jpg", isHero: false },
    { url: "https://img/1.jpg", isHero: true, attribution: "Foto: Jan" },
  ],
  logoUrl: "https://img/logo.png",
  reviews: [{ author: "Eva", rating: 5, text: "Výborné!" }],
  documents: [{ url: "https://blob/menu.pdf", filename: "menu.pdf", contentType: "application/pdf" }],
  rating: 4.6,
  reviewCount: 412,
};

describe("buildSitePrompt", () => {
  const prompt = buildSitePrompt(INPUT);
  it("contains every part of the builder input", () => {
    for (const expected of [
      "# Zadání: web pro Pizzerie Napoli",
      "Telefon: 603 123 456",
      "Po: 11:00–22:00",
      "Ne: zavřeno",
      "Út: neuvedeno",
      "Margherita (169 Kč)",
      "Rozvoz (od 49 Kč)",
      "jednostránkový web",
      "Sekce (v tomto pořadí): Hero (úvodní banner), Služby, Recenze",
      "Rozšíření: Rezervace",
      "Šablona: Premium",
      "#B91C1C, #111827",
      "Písmo nadpisů: Playfair Display",
      "Nálada: Elegantní",
      "Logo: https://img/logo.png",
      "HERO fotka: https://img/1.jpg (Foto: Jan)",
      "Podklad menu.pdf: https://blob/menu.pdf",
      "„Výborné!“ — Eva (★★★★★)",
      "Zdůraznit rozvoz.",
      "Hodnocení na Google: 4,6 ★ (412 recenzí)",
    ]) {
      expect(prompt, expected).toContain(expected);
    }
  });
  it("is deterministic and has no empty sections", () => {
    expect(buildSitePrompt(INPUT)).toBe(prompt);
    expect(prompt).not.toMatch(/## [^\n]+\n\n## /);
  });
  it("works for an empty project", () => {
    const p = buildSitePrompt({
      ...INPUT,
      clientInfo: {},
      photos: [],
      reviews: [],
      documents: [],
      logoUrl: null,
      customInstructions: null,
      style: {},
      rating: null,
    });
    expect(p).toContain("# Zadání: web pro Web – Pizzerie Napoli");
    expect(p).not.toContain("## Podklady");
  });
});

describe("opening hours text", () => {
  it("round-trips", () => {
    expect(
      dayToText([
        { open: "09:00", close: "12:00" },
        { open: "13:00", close: "18:00" },
      ]),
    ).toBe("09:00–12:00, 13:00–18:00");
    expect(textToDay("9:00 - 12:00, 13.00–18:00")).toEqual([
      { open: "09:00", close: "12:00" },
      { open: "13:00", close: "18:00" },
    ]);
    expect(textToDay("Zavřeno")).toEqual([]);
    expect(textToDay("")).toBeUndefined();
    expect(textToDay("ráno")).toBeNull();
  });
  it("reports invalid days", () => {
    const r = textsToOpeningHours({
      mon: "8:00-16:00",
      tue: "nevím",
      wed: "",
      thu: "",
      fri: "",
      sat: "zavřeno",
      sun: "",
    });
    expect(r.invalid).toEqual(["tue"]);
    expect(r.hours).toEqual({ mon: [{ open: "08:00", close: "16:00" }], sat: [] });
  });
});

describe("dominantColors", () => {
  it("skips white, black, grey and transparent pixels", () => {
    const px = (r: number, g: number, b: number, a = 255, n = 1) =>
      Array.from({ length: n }, () => [r, g, b, a]).flat();
    const data = [
      ...px(255, 255, 255, 255, 50),
      ...px(0, 0, 0, 255, 20),
      ...px(128, 128, 128, 255, 20),
      ...px(185, 28, 28, 255, 10),
      ...px(15, 118, 110, 255, 5),
      ...px(1, 2, 250, 0, 30),
    ];
    expect(dominantColors(data)).toEqual(["#B91C1C", "#0F766E"]);
  });
});

describe("fillMonths", () => {
  it("returns 12 months ending with the current Prague month, zero-filled", () => {
    const r = fillMonths([{ period: "2026-10", amount: 99000 }], new Date("2026-10-31T23:30:00Z")); // already Nov 1 in Prague
    expect(r).toHaveLength(12);
    expect(r[11]).toEqual({ period: "2026-11", amountHalere: 0 });
    expect(r[10]).toEqual({ period: "2026-10", amountHalere: 99000 });
    expect(r[0].period).toBe("2025-12");
  });
});

describe("research prompt", () => {
  it("fills placeholders from the lead", () => {
    const out = renderResearchPrompt("{{name}} | {{website}} | {{issues}} | {{unknown}}", {
      name: "Pekárna Kvásek",
      websiteUrl: null,
      scoreFactors: [
        { key: "noWebsite", fired: true, weight: 60, points: 60, detail: "Na Google Maps není uveden web" },
      ],
    } as never);
    expect(out).toBe("Pekárna Kvásek | nemá web | Nemá web (Na Google Maps není uveden web) | {{unknown}}");
  });
});

describe("prompt layout", () => {
  it("separates every heading with a blank line", () => {
    const p = buildSitePrompt(INPUT);
    expect(p.startsWith("# Zadání: web pro Pizzerie Napoli\n\nPostav kompletní")).toBe(true);
    for (const m of p.matchAll(/\n## /g)) expect(p[m.index! - 1]).toBe("\n");
    expect(p).not.toMatch(/\n{3,}/);
  });
});
