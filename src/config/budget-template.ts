// Default "Dotaz na rozpočet" email (asks the client what they would pay per month for website care).
// Stored in email_templates on first use (and by the seed) so it can be edited on the Templates page.

export const BUDGET_TEMPLATE = {
  key: "offer_budget_default",
  kind: "offer_budget" as const,
  name: "Dotaz na rozpočet správy webu",
  subject: "Správa webu {{businessName}} – jaký měsíční rozpočet vám vyhovuje?",
  body: `Dobrý den{{contactGreeting}},

děkuji za dosavadní spolupráci na novém webu. Než vám pošlu nabídku jeho měsíční správy, rád bych ji připravil přesně podle vás.

Kolik byste byli ochotni měsíčně investovat do správy webu? Ta zahrnuje hosting, doménu, zabezpečení, pravidelné aktualizace a úpravy obsahu. Stačí odepsat orientační částku – podle ní vám připravím balíčky na míru.

S pozdravem
{{senderName}}

---
Odhlásit se: {{unsubscribeUrl}}`,
};
