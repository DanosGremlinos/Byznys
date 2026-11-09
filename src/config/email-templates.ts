// Default offer and reminder emails (Webyz). The seed inserts them; migration 0003 rewrote the stored defaults
// to this wording. Each stays editable on the Templates page. The budget question lives in ./budget-template.ts.
//
// Flow: L1 (first contact with a free design) → L2 (final design, fixed one-time price, contract attached as a
// file for signing) → Dotaz na rozpočet (monthly care) → L3 (three monthly care packages from the calculator).

type DefaultTemplate = {
  key: string;
  kind: "offer_l1" | "offer_l2" | "offer_l3" | "dunning_1" | "dunning_2" | "dunning_3";
  name: string;
  subject: string;
  body: string;
};

export const SIGNATURE = `S pozdravem
{{senderName}}
Webyz – weby pro místní firmy`;

export const OFFER_L1_TEMPLATE: DefaultTemplate = {
  key: "offer_l1_default",
  kind: "offer_l1",
  name: "L1 – první oslovení s návrhem webu",
  subject: "Návrh nového webu pro {{businessName}} – už je hotový",
  body: `Dobrý den{{contactGreeting}},

jsme Webyz – dva studenti, kteří dělají weby pro místní firmy. Baví nás to a chceme pomáhat podnikům, aby k nim noví zákazníci snadno trefili. Proto u nás web nestojí desítky tisíc jako u agentur.

Podívali jsme se na vaši online prezentaci a všimli si několika věcí, které vás můžou zbytečně připravovat o zákazníky:

{{issues}}

Místo dlouhého vysvětlování jsme rovnou připravili návrh, jak by mohl váš nový web vypadat:
{{previewUrl}}

Návrh je zdarma a nezávazný. Pokud se vám líbí, upravíme ho přesně podle vás – texty, fotky, barvy i otevírací dobu. Stačí odpovědět na tento e-mail.

Děkujeme, že jste si našli chvilku.

${SIGNATURE}

---
Nechcete od nás další zprávy? Odhlásit se můžete zde: {{unsubscribeUrl}}`,
};

export const OFFER_L2_TEMPLATE: DefaultTemplate = {
  key: "offer_l2_default",
  kind: "offer_l2",
  name: "L2 – finální návrh, cena webu a smlouva v příloze",
  subject: "Finální návrh webu a smlouva k podpisu – {{businessName}}",
  body: `Dobrý den{{contactGreeting}},

děkujeme za zpětnou vazbu! Web jsme doladili a tady je jeho finální podoba:
{{previewUrl}}

Cena za vytvoření webu: {{webPrice}} (jednorázově, bez skrytých poplatků).

V příloze posíláme smlouvu k podpisu. Stačí ji podepsat a poslat zpátky – klidně jako sken nebo fotku. Hned potom web spustíme.

O provoz webu (hosting, doménu, zabezpečení a drobné úpravy) se můžeme starat i dál. Možnosti měsíční správy vám pošleme zvlášť, ať si vyberete, co vám sedí.

Kdybyste chtěli cokoli změnit nebo se na něco zeptat, stačí odpovědět.

${SIGNATURE}

---
Odhlásit se: {{unsubscribeUrl}}`,
};

export const OFFER_L3_TEMPLATE: DefaultTemplate = {
  key: "offer_l3_default",
  kind: "offer_l3",
  name: "L3 – nabídka měsíční správy webu",
  subject: "Správa webu {{businessName}} – balíčky na míru",
  body: `Dobrý den{{contactGreeting}},

děkujeme za odpověď! Podle vašeho rozpočtu jsme připravili tři varianty měsíční správy webu:

{{tierComparison}}

Doporučujeme {{packageName}} za {{monthlyPrice}} měsíčně – je v něm všechno a o web se nemusíte vůbec starat.

Stačí odpovědět, kterou variantu chcete, a o zbytek se postaráme. Správu můžete kdykoli zrušit s měsíční výpovědní lhůtou.

${SIGNATURE}

---
Odhlásit se: {{unsubscribeUrl}}`,
};

export const DUNNING_TEMPLATES: DefaultTemplate[] = [
  {
    key: "dunning_1_default",
    kind: "dunning_1",
    name: "Upomínka 1 – přátelská připomínka (den 0)",
    subject: "Připomínka platby za web {{websiteDomain}}",
    body: `Dobrý den{{contactGreeting}},

jen přátelsky připomínáme platbu {{amount}} za správu webu {{websiteDomain}}, která byla splatná {{dueDate}}. Pokud jste už platili, považujte prosím tento e-mail za bezpředmětný.

${SIGNATURE}`,
  },
  {
    key: "dunning_2_default",
    kind: "dunning_2",
    name: "Upomínka 2 – připomínka (den 3)",
    subject: "Upomínka – platba za web {{websiteDomain}} je po splatnosti",
    body: `Dobrý den{{contactGreeting}},

platba {{amount}} za správu webu {{websiteDomain}} je {{daysOverdue}} dní po splatnosti (splatná {{dueDate}}).

Děkujeme za brzkou úhradu.

${SIGNATURE}`,
  },
  {
    key: "dunning_3_default",
    kind: "dunning_3",
    name: "Upomínka 3 – poslední výzva (den 7)",
    subject: "Poslední výzva k úhradě – web {{websiteDomain}}",
    body: `Dobrý den{{contactGreeting}},

platba {{amount}} za správu webu {{websiteDomain}} (splatná {{dueDate}}) stále nedorazila. Pokud ji neobdržíme do 3 dnů, budeme nuceni web dočasně pozastavit.

${SIGNATURE}`,
  },
];

export const DEFAULT_EMAIL_TEMPLATES: DefaultTemplate[] = [
  OFFER_L1_TEMPLATE,
  OFFER_L2_TEMPLATE,
  OFFER_L3_TEMPLATE,
  ...DUNNING_TEMPLATES,
];

/** Monthly website care packages (calculator templates). Premium = everything in Standard + 3 visible extras. */
export const DEFAULT_CARE_TIERS = [
  {
    name: "Základ",
    description: "Měsíční správa webu – web běží, je zabezpečený a zálohovaný.",
    monthlyPriceHalere: 49_000,
    features: [
      "Hosting a doména",
      "SSL certifikát (zabezpečení)",
      "Pravidelné zálohy",
      "Technické aktualizace a dohled",
      "1 drobná úprava obsahu měsíčně",
    ],
    sortOrder: 1,
  },
  {
    name: "Standard",
    description: "Měsíční správa webu včetně pravidelných úprav obsahu.",
    monthlyPriceHalere: 99_000,
    features: [
      "Hosting a doména",
      "SSL certifikát (zabezpečení)",
      "Pravidelné zálohy",
      "Technické aktualizace a dohled",
      "3 úpravy obsahu měsíčně (texty, fotky, ceník, otevírací doba)",
      "Odpověď do 2 pracovních dnů",
    ],
    sortOrder: 2,
  },
  {
    name: "Premium",
    description: "Kompletní péče – o web se nemusíte vůbec starat.",
    monthlyPriceHalere: 199_000,
    features: [
      "Hosting a doména",
      "SSL certifikát (zabezpečení)",
      "Pravidelné zálohy",
      "Technické aktualizace a dohled",
      "Neomezené drobné úpravy obsahu",
      "Odpověď do 24 hodin",
      "Péče o profil firmy na Google Mapách",
      "Měsíční přehled návštěvnosti",
      "Sezónní novinky a akce na webu",
    ],
    sortOrder: 3,
  },
];
