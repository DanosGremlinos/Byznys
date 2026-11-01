// Static pools of realistic Czech data used by the seed script.
import type { OpeningHours, ServiceItem } from "./schema/types";

export type CityInfo = { name: string; zip: string; lat: number; lng: number; streets: string[] };

export const CITIES: CityInfo[] = [
  {
    name: "Brno",
    zip: "602 00",
    lat: 49.1951,
    lng: 16.6068,
    streets: [
      "Masarykova",
      "Kounicova",
      "Údolní",
      "Lidická",
      "Cejl",
      "Křenová",
      "Veveří",
      "Štefánikova",
      "Palackého třída",
      "Bratislavská",
    ],
  },
  {
    name: "Praha",
    zip: "120 00",
    lat: 50.0755,
    lng: 14.4378,
    streets: [
      "Vinohradská",
      "Korunní",
      "Bělehradská",
      "Táborská",
      "Seifertova",
      "Milady Horákové",
      "Dejvická",
      "Na Pankráci",
    ],
  },
  {
    name: "Olomouc",
    zip: "779 00",
    lat: 49.5938,
    lng: 17.2509,
    streets: [
      "Horní náměstí",
      "třída Svobody",
      "Palackého",
      "Dolní náměstí",
      "Masarykova třída",
      "Pavelčákova",
    ],
  },
  {
    name: "Ostrava",
    zip: "702 00",
    lat: 49.8209,
    lng: 18.2625,
    streets: ["Nádražní", "Stodolní", "28. října", "Českobratrská", "Hlavní třída"],
  },
  {
    name: "Plzeň",
    zip: "301 00",
    lat: 49.7384,
    lng: 13.3736,
    streets: ["Americká třída", "Klatovská třída", "Prešovská", "Solní", "Smetanovy sady"],
  },
  {
    name: "Zlín",
    zip: "760 01",
    lat: 49.2265,
    lng: 17.6707,
    streets: ["třída Tomáše Bati", "Štefánikova", "Dlouhá", "Bartošova"],
  },
  {
    name: "Jihlava",
    zip: "586 01",
    lat: 49.3961,
    lng: 15.5912,
    streets: ["Masarykovo náměstí", "Znojemská", "Brněnská", "Husova"],
  },
];

export type CategoryKey =
  | "pizzerie"
  | "restaurace"
  | "kavarna"
  | "kadernictvi"
  | "kosmetika"
  | "instalater"
  | "elektrikar"
  | "truhlarstvi"
  | "autoservis"
  | "pekarna";

export type CategoryInfo = {
  key: CategoryKey;
  label: string;
  names: string[];
  hours: OpeningHours;
  services: ServiceItem[];
};

const weekdays = (open: string, close: string) =>
  ({
    mon: [{ open, close }],
    tue: [{ open, close }],
    wed: [{ open, close }],
    thu: [{ open, close }],
    fri: [{ open, close }],
  }) satisfies OpeningHours;

const kc = (czk: number) => czk * 100;

export const CATEGORIES: CategoryInfo[] = [
  {
    key: "pizzerie",
    label: "Pizzerie",
    names: [
      "Pizzerie Napoli",
      "Pizzeria Da Mario",
      "Pizza Bella",
      "Pizzerie U Kocoura",
      "Pizzeria Il Forno",
      "Pizzerie Vesuvio",
      "Pizza Amore",
    ],
    hours: {
      ...weekdays("11:00", "22:00"),
      sat: [{ open: "11:00", close: "23:00" }],
      sun: [{ open: "12:00", close: "21:00" }],
    },
    services: [
      {
        name: "Margherita",
        description: "rajčatový základ, mozzarella, bazalka",
        priceHalere: kc(169),
        category: "Pizza",
      },
      {
        name: "Prosciutto",
        description: "šunka, mozzarella, rajčata",
        priceHalere: kc(199),
        category: "Pizza",
      },
      { name: "Quattro formaggi", description: "čtyři druhy sýrů", priceHalere: kc(219), category: "Pizza" },
      { name: "Diavola", description: "pikantní salám, chilli", priceHalere: kc(209), category: "Pizza" },
      { name: "Tiramisu", priceHalere: kc(89), category: "Dezerty" },
      { name: "Rozvoz po městě", priceText: "zdarma od 400 Kč", category: "Služby" },
    ],
  },
  {
    key: "restaurace",
    label: "Restaurace",
    names: [
      "Restaurace U Zlatého lva",
      "Hostinec Na Rychtě",
      "Bistro Vinohrady",
      "Restaurace Stará pošta",
      "Hospůdka U Dvou koček",
    ],
    hours: {
      ...weekdays("10:30", "22:00"),
      sat: [{ open: "11:00", close: "23:00" }],
      sun: [{ open: "11:00", close: "20:00" }],
    },
    services: [
      { name: "Polední menu", priceText: "od 149 Kč", category: "Menu" },
      { name: "Svíčková na smetaně, houskový knedlík", priceHalere: kc(229), category: "Hlavní jídla" },
      { name: "Smažený řízek, bramborový salát", priceHalere: kc(219), category: "Hlavní jídla" },
      { name: "Plzeňský Prazdroj 0,5 l", priceHalere: kc(59), category: "Nápoje" },
      { name: "Firemní akce a oslavy", priceText: "dle domluvy", category: "Služby" },
    ],
  },
  {
    key: "kavarna",
    label: "Kavárna",
    names: ["Kavárna Pražírna", "Café Momo", "Kavárna Na Rohu", "Kafe & Dort"],
    hours: {
      ...weekdays("08:00", "19:00"),
      sat: [{ open: "09:00", close: "19:00" }],
      sun: [{ open: "10:00", close: "18:00" }],
    },
    services: [
      { name: "Espresso", priceHalere: kc(55), category: "Káva" },
      { name: "Flat white", priceHalere: kc(79), category: "Káva" },
      { name: "Domácí cheesecake", priceHalere: kc(95), category: "Dezerty" },
      { name: "Snídaňové menu", priceText: "do 11:00, od 145 Kč", category: "Snídaně" },
    ],
  },
  {
    key: "kadernictvi",
    label: "Kadeřnictví",
    names: [
      "Kadeřnictví Jana",
      "Salon Elegance",
      "Studio Vlasy & Styl",
      "Barber Shop Fousy",
      "Kadeřnictví Lucie",
      "Hair Studio Glam",
    ],
    hours: { ...weekdays("09:00", "18:00"), sat: [{ open: "08:00", close: "12:00" }], sun: [] },
    services: [
      { name: "Dámský střih", priceText: "od 450 Kč", category: "Dámské" },
      { name: "Barvení", priceText: "od 890 Kč", category: "Dámské" },
      { name: "Melír", priceText: "od 1 290 Kč", category: "Dámské" },
      { name: "Pánský střih", priceHalere: kc(350), category: "Pánské" },
      { name: "Úprava vousů", priceHalere: kc(250), category: "Pánské" },
    ],
  },
  {
    key: "kosmetika",
    label: "Kosmetický salon",
    names: ["Kosmetický salon Lotus", "Beauty Studio Petra", "Salon Krása", "Kosmetika Iveta"],
    hours: { ...weekdays("08:00", "19:00"), sat: [{ open: "09:00", close: "13:00" }], sun: [] },
    services: [
      { name: "Kompletní ošetření pleti", priceHalere: kc(990), category: "Pleť" },
      { name: "Lash lifting", priceHalere: kc(890), category: "Řasy a obočí" },
      { name: "Úprava a barvení obočí", priceHalere: kc(290), category: "Řasy a obočí" },
      { name: "Gelové nehty", priceText: "od 650 Kč", category: "Nehty" },
    ],
  },
  {
    key: "instalater",
    label: "Instalatér",
    names: ["Instalatérství Novák", "Voda-Topení Dvořák", "Instalatér Pokorný", "Topenářství Beneš"],
    hours: { ...weekdays("07:00", "17:00"), sat: [], sun: [] },
    services: [
      { name: "Havarijní služba 24/7", priceText: "výjezd od 690 Kč", category: "Služby" },
      { name: "Výměna baterie", priceText: "od 590 Kč", category: "Služby" },
      { name: "Montáž kotle", priceText: "dle rozsahu", category: "Topení" },
      { name: "Rekonstrukce koupelny", priceText: "na zakázku", category: "Rekonstrukce" },
    ],
  },
  {
    key: "elektrikar",
    label: "Elektrikář",
    names: ["Elektro Svoboda", "Elektroinstalace Procházka", "Elektrikář Černý", "ElektroServis Krejčí"],
    hours: { ...weekdays("07:00", "16:00"), sat: [], sun: [] },
    services: [
      { name: "Revize elektroinstalace", priceText: "od 1 500 Kč", category: "Revize" },
      { name: "Elektroinstalace bytů a domů", priceText: "na zakázku", category: "Instalace" },
      { name: "Montáž wallboxu", priceText: "od 6 900 Kč", category: "Instalace" },
    ],
  },
  {
    key: "truhlarstvi",
    label: "Truhlářství",
    names: ["Truhlářství Kučera", "Dřevovýroba Veselý", "Truhlářství Bartoš", "Nábytek na míru Šťastný"],
    hours: { ...weekdays("07:00", "15:30"), sat: [], sun: [] },
    services: [
      { name: "Kuchyňské linky na míru", priceText: "na zakázku", category: "Nábytek" },
      { name: "Vestavěné skříně", priceText: "na zakázku", category: "Nábytek" },
      { name: "Dřevěné schodiště", priceText: "na zakázku", category: "Stavební truhlářství" },
    ],
  },
  {
    key: "autoservis",
    label: "Autoservis",
    names: ["Autoservis Horák", "Pneuservis Marek", "Autodílna Němec", "Auto Fiala servis"],
    hours: { ...weekdays("07:30", "17:00"), sat: [{ open: "08:00", close: "12:00" }], sun: [] },
    services: [
      { name: "Přezutí pneumatik", priceHalere: kc(690), category: "Pneuservis" },
      { name: "Výměna oleje", priceText: "od 490 Kč + materiál", category: "Servis" },
      { name: "Příprava na STK", priceHalere: kc(890), category: "Servis" },
      { name: "Diagnostika", priceHalere: kc(590), category: "Servis" },
    ],
  },
  {
    key: "pekarna",
    label: "Pekárna",
    names: ["Pekárna Kvásek", "Cukrárna U Šimků", "Pekařství Zrnko", "Cukrárna Sladký sen"],
    hours: { ...weekdays("06:00", "18:00"), sat: [{ open: "07:00", close: "12:00" }], sun: [] },
    services: [
      { name: "Kváskový chléb 1 kg", priceHalere: kc(89), category: "Pečivo" },
      { name: "Koláče", priceHalere: kc(25), category: "Sladké" },
      { name: "Dorty na objednávku", priceText: "od 650 Kč", category: "Dorty" },
    ],
  },
];

export const FIRST_NAMES_M = [
  "Jan",
  "Petr",
  "Martin",
  "Tomáš",
  "Jiří",
  "Pavel",
  "Lukáš",
  "Jakub",
  "Michal",
  "David",
  "Ondřej",
  "Marek",
];
export const FIRST_NAMES_F = [
  "Jana",
  "Petra",
  "Lucie",
  "Kateřina",
  "Eva",
  "Martina",
  "Veronika",
  "Tereza",
  "Lenka",
  "Ivana",
  "Hana",
  "Barbora",
];
export const LAST_NAMES_M = [
  "Novák",
  "Svoboda",
  "Dvořák",
  "Černý",
  "Procházka",
  "Kučera",
  "Veselý",
  "Horák",
  "Němec",
  "Marek",
  "Pokorný",
  "Fiala",
];
export const LAST_NAMES_F = [
  "Nováková",
  "Svobodová",
  "Dvořáková",
  "Černá",
  "Procházková",
  "Kučerová",
  "Veselá",
  "Horáková",
  "Němcová",
  "Marková",
  "Pokorná",
  "Fialová",
];

export const REVIEW_TEXTS: { rating: number; text: string }[] = [
  { rating: 5, text: "Naprostá spokojenost, příjemná obsluha a skvělá kvalita. Určitě se vrátíme!" },
  { rating: 5, text: "Nejlepší v okolí. Rychlé, ochotné a za rozumnou cenu." },
  { rating: 5, text: "Chodím sem pravidelně už několik let a nikdy jsem nebyl zklamaný." },
  { rating: 5, text: "Profesionální přístup, vše domluvené přesně podle dohody. Doporučuji." },
  { rating: 4, text: "Velmi dobré, jen bylo trochu déle čekání. Jinak bez výhrad." },
  { rating: 4, text: "Příjemné prostředí a milý personál. Cena odpovídá kvalitě." },
  { rating: 4, text: "Dobrá zkušenost, objednání po telefonu proběhlo bez problémů." },
  { rating: 3, text: "Průměr. Nic hrozného, ale ani nic extra." },
  { rating: 2, text: "Bohužel jsme museli dlouho čekat a nikdo se neomluvil." },
];

export const DESIGN_ISSUES = [
  "Text je na mobilu příliš malý",
  "Obrázky nejsou optimalizované",
  "Chybí jasná výzva k akci (telefon, rezervace)",
  "Zastaralé písmo a rozvržení",
  "Kontaktní údaje jsou jen v obrázku",
  "Stránka nemá favicon",
  "Rozložení pomocí tabulek",
];

/** Removes diacritics and produces a URL/domain-friendly slug. */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, "a")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
