// Assembles everything from the Builder into one structured prompt for Claude Code. Pure function.
import { BUILDER_TEMPLATES, EXTRA_LABELS, MOOD_LABELS, PAGE_LABELS, SECTION_LABELS } from "@/config/builder";
import type { BuilderClientInfo, BuilderStructure, BuilderStyle, OpeningHours } from "@/db/schema/types";
import { formatCzk } from "@/lib/format";

export type PromptInput = {
  projectName: string;
  clientInfo: BuilderClientInfo;
  structure: BuilderStructure;
  style: BuilderStyle;
  customInstructions: string | null;
  /** Selected photos in display order. */
  photos: { url: string; isHero: boolean; attribution?: string | null }[];
  logoUrl: string | null;
  /** Selected reviews (testimonials). */
  reviews: { author: string; rating: number; text: string }[];
  /** Own uploads other than photos/logo (menus, price lists, PDFs). */
  documents: { url: string; filename: string | null; contentType: string | null }[];
  rating?: number | null;
  reviewCount?: number | null;
};

const DAY_LABELS: [keyof OpeningHours, string][] = [
  ["mon", "Po"],
  ["tue", "Út"],
  ["wed", "St"],
  ["thu", "Čt"],
  ["fri", "Pá"],
  ["sat", "So"],
  ["sun", "Ne"],
];

export function formatOpeningHours(h: OpeningHours | undefined | null): string[] {
  if (!h) return [];
  return DAY_LABELS.map(([d, label]) => {
    const slots = h[d];
    return `${label}: ${slots === undefined ? "neuvedeno" : slots.length ? slots.map((s) => `${s.open}–${s.close}`).join(", ") : "zavřeno"}`;
  });
}

const bullet = (items: string[]) => items.map((i) => `- ${i}`).join("\n");
const section = (title: string, body: string) => (body.trim() ? `## ${title}\n\n${body.trim()}` : "");

export function buildSitePrompt(input: PromptInput): string {
  const c = input.clientInfo;
  const name = c.businessName || input.projectName;
  const template = BUILDER_TEMPLATES.find((t) => t.key === input.style.template);

  const info = bullet(
    [
      `Název: ${name}`,
      c.category && `Obor: ${c.category}`,
      c.address && `Adresa: ${c.address}`,
      c.city && !c.address?.includes(c.city) && `Město: ${c.city}`,
      c.phone && `Telefon: ${c.phone}`,
      c.email && `E-mail: ${c.email}`,
      c.contactPerson && `Kontaktní osoba: ${c.contactPerson}`,
      c.domain && `Doména: ${c.domain}`,
      c.currentWebsite && `Současný web (jen pro inspiraci obsahem, ne designem): ${c.currentWebsite}`,
      input.rating &&
        `Hodnocení na Google: ${input.rating.toLocaleString("cs-CZ")} ★ (${input.reviewCount ?? 0} recenzí)`,
      ...Object.entries(c.socialLinks ?? {}).map(([k, v]) => `${k}: ${v}`),
    ].filter(Boolean) as string[],
  );

  const hours = formatOpeningHours(c.openingHours);
  const services = (c.services ?? []).map((s) => {
    const price = s.priceHalere !== undefined ? formatCzk(s.priceHalere).replace(/\s/g, " ") : s.priceText;
    return `${s.category ? `[${s.category}] ` : ""}${s.name}${s.description ? ` – ${s.description}` : ""}${price ? ` (${price})` : ""}`;
  });

  const structure = [
    `Typ: ${input.structure.mode === "one-page" ? "jednostránkový web (sekce na jedné stránce, kotvy v menu)" : "vícestránkový web"}`,
    input.structure.mode === "multi-page" && input.structure.pages.length
      ? `Stránky: ${input.structure.pages.map((p) => PAGE_LABELS[p] ?? p).join(", ")}`
      : null,
    input.structure.sections.length
      ? `Sekce (v tomto pořadí): ${input.structure.sections.map((s) => SECTION_LABELS[s] ?? s).join(", ")}`
      : null,
    input.structure.extras.length
      ? `Rozšíření: ${input.structure.extras.map((e) => EXTRA_LABELS[e] ?? e).join(", ")}`
      : null,
  ].filter(Boolean) as string[];

  const style = [
    template && `Šablona: ${template.label} – ${template.description}`,
    input.style.palette?.length &&
      `Barevná paleta${input.style.paletteSource === "logo" ? " (z loga)" : ""}: ${input.style.palette.join(", ")}`,
    input.style.fonts?.heading &&
      `Písmo nadpisů: ${input.style.fonts.heading} (Google Fonts, se sadou latin-ext)`,
    input.style.fonts?.body && `Písmo textu: ${input.style.fonts.body} (Google Fonts, se sadou latin-ext)`,
    input.style.mood?.length && `Nálada: ${input.style.mood.map((m) => MOOD_LABELS[m] ?? m).join(", ")}`,
    ...(input.style.referenceUrls?.length
      ? [`Referenční weby (inspirace, nekopírovat): ${input.style.referenceUrls.join(", ")}`]
      : []),
  ].filter(Boolean) as string[];

  const assets: string[] = [];
  if (input.logoUrl) assets.push(`Logo: ${input.logoUrl}`);
  input.photos.forEach((p, i) =>
    assets.push(
      `${p.isHero ? "HERO fotka" : `Fotka ${i + 1}`}: ${p.url}${p.attribution ? ` (${p.attribution})` : ""}`,
    ),
  );
  input.documents.forEach((d) => assets.push(`Podklad ${d.filename ?? ""}: ${d.url}`.replace("  ", " ")));

  const reviews = input.reviews.map(
    (r) => `„${r.text}“ — ${r.author} (${"★".repeat(Math.max(1, Math.min(5, r.rating)))})`,
  );

  return [
    `# Zadání: web pro ${name}`,
    "Postav kompletní, produkčně připravený web pro malou českou firmu podle zadání níže. Veškerý obsah webu je v češtině.",
    section("Klient", info),
    section("Otevírací doba", bullet(hours)),
    section("Služby / menu / ceník", bullet(services)),
    section("Struktura webu", bullet(structure)),
    section("Vzhled", bullet(style)),
    section(
      "Podklady",
      assets.length
        ? `${bullet(assets)}\n\nObrázky stáhni do projektu (neodkazuj na cizí URL), optimalizuj je (WebP/AVIF, správné rozměry) a doplň smysluplné alt texty. Hero fotku použij v úvodní sekci.`
        : "",
    ),
    section("Recenze k použití jako reference", bullet(reviews)),
    section("Vlastní instrukce", input.customInstructions ?? ""),
    section(
      "Požadavky na kvalitu",
      bullet([
        "Responzivní design (mobil první), funkční na mobilu, tabletu i desktopu.",
        "Výkon: Lighthouse/PageSpeed ≥ 90 na mobilu, minimum JavaScriptu, líné načítání obrázků.",
        "SEO: unikátní <title> a meta description, jeden <h1>, strukturovaná data LocalBusiness (schema.org) s adresou, telefonem a otevírací dobou, sitemap.xml a robots.txt.",
        "Přístupnost: sémantické HTML, dostatečný kontrast, ovladatelnost klávesnicí.",
        "Klikací telefon (tel:) a e-mail (mailto:), na mobilu viditelné tlačítko pro zavolání.",
        "Kontaktní formulář s ochranou proti spamu a souhlasem se zpracováním osobních údajů (GDPR); patička s IČO, pokud je známé.",
        "Mapa: vložená Google mapa nebo odkaz na Google Maps podle adresy.",
        "Žádný vymyšlený obsah: použij jen uvedené údaje; co chybí, označ jako TODO pro doplnění.",
      ]),
    ),
    section(
      "Výstup",
      bullet([
        "Kompletní zdrojový kód webu připravený k nasazení na Vercel.",
        "Krátké README: jak web spustit, kde upravit texty, ceny a otevírací dobu.",
        "Seznam TODO bodů, které je potřeba doplnit od klienta.",
      ]),
    ),
  ]
    .filter((part) => part !== "")
    .join("\n\n")
    .concat("\n");
}
