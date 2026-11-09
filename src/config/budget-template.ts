// Default "Dotaz na rozpočet" email (asks the client what they would pay per month for website care).
// Stored in email_templates on first use (and by the seed) so it can be edited on the Templates page.

export const BUDGET_TEMPLATE = {
  key: "offer_budget_default",
  kind: "offer_budget" as const,
  name: "Dotaz na rozpočet správy webu",
  subject: "Správa webu {{businessName}} – jaký měsíční rozpočet vám vyhovuje?",
  body: `Dobrý den{{contactGreeting}},

děkujeme za spolupráci na novém webu! Aby web i po spuštění fungoval bez starostí, nabízíme jeho měsíční správu – hosting a doménu, zabezpečení, zálohy, aktualizace a úpravy obsahu (třeba nové fotky, ceník nebo otevírací doba).

Nechceme vám vnucovat hotový ceník, proto se rovnou ptáme: kolik byste byli ochotni do správy webu měsíčně investovat? Stačí odepsat orientační částku a podle ní vám připravíme balíčky na míru.

S pozdravem
{{senderName}}
Webyz – weby pro místní firmy

---
Odhlásit se: {{unsubscribeUrl}}`,
};
