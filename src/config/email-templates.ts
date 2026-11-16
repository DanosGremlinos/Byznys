// Default email texts. They are copied into email_templates (seed / first use) and can then be edited
// on the Šablony page; "Obnovit výchozí text" there restores the version from this file.
//
// Writing rules (deliverability + response rate):
// - one person writing to one business: first person, plain language, no marketing phrases;
// - short, one link, a simple question at the end;
// - confident, never apologetic ("nebudu vás dál zdržovat", "pokud nemáte zájem, stačí odepsat" etc.);
// - quiet opt-out line at the bottom (shown as a small "Odhlásit se" link in the HTML version).

export type DefaultEmailTemplate = {
  key: string;
  kind: "offer_l1" | "offer_l2" | "offer_budget" | "offer_l3" | "dunning_1" | "dunning_2" | "dunning_3";
  name: string;
  subject: string;
  body: string;
};

const OPT_OUT = "Nechcete další e-maily? Odhlásit se: {{unsubscribeUrl}}";

export const BUDGET_TEMPLATE = {
  key: "offer_budget_default",
  kind: "offer_budget" as const,
  name: "Dotaz na rozpočet správy webu",
  subject: "{{businessName}} – kolik chcete měsíčně dávat za web?",
  body: `Dobrý den{{contactGreeting}},

než vám pošlu nabídku na správu nového webu, chci ji připravit tak, aby vám sedla i cenou.

Kolik byste byli ochotni za web dávat měsíčně? Správa zahrnuje hosting, doménu, zabezpečení, zálohy a drobné úpravy obsahu, kdykoliv budete potřebovat.

Stačí odepsat orientační částku a podle ní vám připravím dvě nebo tři varianty.

S pozdravem
{{senderName}}

${OPT_OUT}`,
} satisfies DefaultEmailTemplate;

export const DEFAULT_EMAIL_TEMPLATES: DefaultEmailTemplate[] = [
  {
    key: "offer_l1_default",
    kind: "offer_l1",
    name: "L1 – první oslovení s náhledem",
    subject: "Nápad na nový web pro {{businessName}}",
    body: `Dobrý den{{contactGreeting}},

narazil jsem na {{businessName}} na Google Mapách a podíval se, jak se prezentujete na internetu. Všiml jsem si pár věcí, které vás můžou stát zákazníky:

{{issues}}

Zkusil jsem proto připravit, jak by mohl vypadat váš nový web. Ukázka je tady: {{previewUrl}}

Co na něj říkáte? Pokud se vám bude líbit, rád pošlu podrobnosti.

S pozdravem
{{senderName}}

${OPT_OUT}`,
  },
  {
    key: "offer_l2_default",
    kind: "offer_l2",
    name: "L2 – finální návrh, smlouva a dotaz na rozpočet",
    subject: "Finální návrh webu pro {{businessName}}",
    body: `Dobrý den{{contactGreeting}},

děkuji za odpověď, jsem rád, že se vám návrh líbí. Finální podobu webu najdete tady: {{previewUrl}}

V příloze posílám smlouvu. Web vám můžu i dál spravovat – hosting, doména, zabezpečení, zálohy a úpravy obsahu.

Abych vám správu připravil na míru: kolik byste byli ochotni za web dávat měsíčně? Stačí odepsat orientační částku a podle ní vám pošlu tři varianty.

Pokud byste chtěli na webu cokoliv upravit, napište mi.

S pozdravem
{{senderName}}

${OPT_OUT}`,
  },
  BUDGET_TEMPLATE,
  {
    key: "offer_l3_default",
    kind: "offer_l3",
    name: "L3 – nabídka správy webu (balíčky)",
    subject: "Správa webu {{businessName}} – varianty",
    body: `Dobrý den{{contactGreeting}},

děkuji za informaci. Podle ní jsem připravil varianty správy webu:

{{tierComparison}}

Za mě nejvíc dává smysl {{packageName}} za {{monthlyPrice}} měsíčně. Když zaplatíte rovnou na celý rok, vyjde vás na {{yearlyPrice}}. Obsah i cenu rád upravím podle toho, co potřebujete.

Která varianta vám vyhovuje? Stačí odepsat a vše připravím.

S pozdravem
{{senderName}}

${OPT_OUT}`,
  },
  {
    key: "dunning_1_default",
    kind: "dunning_1",
    name: "Upomínka 1 – přátelská připomínka (den 0)",
    subject: "Připomínka platby za web {{websiteDomain}}",
    body: `Dobrý den{{contactGreeting}},

jen připomínám platbu {{amount}} za správu webu {{websiteDomain}}, která byla splatná {{dueDate}}.

Pokud už je zaplaceno, děkuji a tento e-mail prosím neřešte.

S pozdravem
{{senderName}}`,
  },
  {
    key: "dunning_2_default",
    kind: "dunning_2",
    name: "Upomínka 2 – připomínka (den 3)",
    subject: "Platba za web {{websiteDomain}} je po splatnosti",
    body: `Dobrý den{{contactGreeting}},

platba {{amount}} za správu webu {{websiteDomain}} je {{daysOverdue}} dní po splatnosti (splatná {{dueDate}}).

Můžete ji prosím uhradit v nejbližších dnech? Pokud je nějaký problém, napište mi a domluvíme se.

S pozdravem
{{senderName}}`,
  },
  {
    key: "dunning_3_default",
    kind: "dunning_3",
    name: "Upomínka 3 – poslední výzva (den 7)",
    subject: "Poslední připomínka platby – web {{websiteDomain}}",
    body: `Dobrý den{{contactGreeting}},

platba {{amount}} za správu webu {{websiteDomain}} (splatná {{dueDate}}) stále nedorazila.

Pokud ji neobdržím do 3 dnů, budu muset web dočasně pozastavit. Hned po zaplacení ho zase zapnu. Kdyby bylo potřeba se domluvit na jiném termínu, stačí odepsat.

S pozdravem
{{senderName}}`,
  },
];

export function defaultTemplateFor(key: string): DefaultEmailTemplate | undefined {
  return DEFAULT_EMAIL_TEMPLATES.find((t) => t.key === key);
}
