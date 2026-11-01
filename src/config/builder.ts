// Builder options (labels in Czech). Keys are stored in builder_projects.structure / style.

export const BUILDER_PAGES = [
  { key: "home", label: "Úvod" },
  { key: "about", label: "O nás" },
  { key: "services", label: "Služby" },
  { key: "gallery", label: "Galerie" },
  { key: "pricing", label: "Ceník" },
  { key: "contact", label: "Kontakt" },
  { key: "menu", label: "Menu / jídelní lístek" },
  { key: "references", label: "Reference" },
  { key: "faq", label: "Časté dotazy" },
] as const;

export const BUILDER_SECTIONS = [
  { key: "hero", label: "Hero (úvodní banner)" },
  { key: "services", label: "Služby" },
  { key: "gallery", label: "Galerie" },
  { key: "reviews", label: "Recenze" },
  { key: "map", label: "Mapa" },
  { key: "opening-hours", label: "Otevírací doba" },
  { key: "contact-form", label: "Kontaktní formulář" },
  { key: "faq", label: "FAQ" },
  { key: "pricing", label: "Ceník" },
  { key: "about", label: "O nás" },
] as const;

export const BUILDER_EXTRAS = [
  { key: "reservations", label: "Rezervace" },
  { key: "blog", label: "Blog" },
  { key: "multilingual", label: "Vícejazyčnost" },
  { key: "eshop", label: "E-shop" },
] as const;

export const BUILDER_TEMPLATES = [
  {
    key: "industrial",
    label: "Industrial",
    description: "Robustní, kontrastní, tmavé plochy, výrazná typografie, ideální pro řemesla a dílny.",
  },
  {
    key: "economy",
    label: "Economy",
    description: "Jednoduchý a rychlý jednostránkový web, jen to podstatné: služby, kontakt, otevírací doba.",
  },
  {
    key: "premium",
    label: "Premium",
    description: "Elegantní, hodně vzduchu, velké fotografie, jemné animace, důraz na atmosféru.",
  },
  {
    key: "business",
    label: "Business",
    description: "Profesionální a důvěryhodný, jasná struktura, reference a výzvy k akci.",
  },
  {
    key: "vip",
    label: "VIP",
    description: "Luxusní, na míru, prémiové detaily a mikrointerakce, maximální dojem.",
  },
] as const;

export const BUILDER_MOODS = [
  { key: "modern", label: "Moderní" },
  { key: "elegant", label: "Elegantní" },
  { key: "playful", label: "Hravý" },
  { key: "minimal", label: "Minimalistický" },
  { key: "traditional", label: "Tradiční" },
  { key: "warm", label: "Útulný" },
  { key: "bold", label: "Výrazný" },
  { key: "natural", label: "Přírodní" },
] as const;

/** Google Fonts with full Czech (latin-ext) support. */
export const BUILDER_FONTS = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Montserrat",
  "Poppins",
  "Lato",
  "Source Sans 3",
  "Nunito",
  "Raleway",
  "Work Sans",
  "Playfair Display",
  "Merriweather",
  "Lora",
  "Cormorant Garamond",
  "Oswald",
  "Bebas Neue",
] as const;

export const DEFAULT_STRUCTURE = {
  mode: "one-page" as const,
  pages: ["home"],
  sections: ["hero", "services", "gallery", "reviews", "opening-hours", "map", "contact-form"],
  extras: [] as string[],
};

const labels = <T extends readonly { key: string; label: string }[]>(list: T) =>
  Object.fromEntries(list.map((x) => [x.key, x.label])) as Record<string, string>;
export const PAGE_LABELS = labels(BUILDER_PAGES);
export const SECTION_LABELS = labels(BUILDER_SECTIONS);
export const EXTRA_LABELS = labels(BUILDER_EXTRAS);
export const MOOD_LABELS = labels(BUILDER_MOODS);
