-- Data only: Webyz wording for the default emails (rows with the default keys) and the calculator
-- package templates rewritten as monthly website care. Prices are left as they are.
UPDATE "email_templates" SET "name" = $tpl$Dotaz na rozpočet správy webu$tpl$, "subject" = $tpl$Správa webu {{businessName}} – jaký měsíční rozpočet vám vyhovuje?$tpl$, "body" = $tpl$Dobrý den{{contactGreeting}},

děkujeme za spolupráci na novém webu! Aby web i po spuštění fungoval bez starostí, nabízíme jeho měsíční správu – hosting a doménu, zabezpečení, zálohy, aktualizace a úpravy obsahu (třeba nové fotky, ceník nebo otevírací doba).

Nechceme vám vnucovat hotový ceník, proto se rovnou ptáme: kolik byste byli ochotni do správy webu měsíčně investovat? Stačí odepsat orientační částku a podle ní vám připravíme balíčky na míru.

S pozdravem
{{senderName}}
Webyz – weby pro místní firmy

---
Odhlásit se: {{unsubscribeUrl}}$tpl$ WHERE "key" = $tpl$offer_budget_default$tpl$;--> statement-breakpoint
UPDATE "email_templates" SET "name" = $tpl$L1 – první oslovení s návrhem webu$tpl$, "subject" = $tpl$Návrh nového webu pro {{businessName}} – už je hotový$tpl$, "body" = $tpl$Dobrý den{{contactGreeting}},

jsme Webyz – dva studenti, kteří dělají weby pro místní firmy. Baví nás to a chceme pomáhat podnikům, aby k nim noví zákazníci snadno trefili. Proto u nás web nestojí desítky tisíc jako u agentur.

Podívali jsme se na vaši online prezentaci a všimli si několika věcí, které vás můžou zbytečně připravovat o zákazníky:

{{issues}}

Místo dlouhého vysvětlování jsme rovnou připravili návrh, jak by mohl váš nový web vypadat:
{{previewUrl}}

Návrh je zdarma a nezávazný. Pokud se vám líbí, upravíme ho přesně podle vás – texty, fotky, barvy i otevírací dobu. Stačí odpovědět na tento e-mail.

Děkujeme, že jste si našli chvilku.

S pozdravem
{{senderName}}
Webyz – weby pro místní firmy

---
Nechcete od nás další zprávy? Odhlásit se můžete zde: {{unsubscribeUrl}}$tpl$ WHERE "key" = $tpl$offer_l1_default$tpl$;--> statement-breakpoint
UPDATE "email_templates" SET "name" = $tpl$L2 – finální návrh, cena webu a smlouva v příloze$tpl$, "subject" = $tpl$Finální návrh webu a smlouva k podpisu – {{businessName}}$tpl$, "body" = $tpl$Dobrý den{{contactGreeting}},

děkujeme za zpětnou vazbu! Web jsme doladili a tady je jeho finální podoba:
{{previewUrl}}

Cena za vytvoření webu: {{webPrice}} (jednorázově, bez skrytých poplatků).

V příloze posíláme smlouvu k podpisu. Stačí ji podepsat a poslat zpátky – klidně jako sken nebo fotku. Hned potom web spustíme.

O provoz webu (hosting, doménu, zabezpečení a drobné úpravy) se můžeme starat i dál. Možnosti měsíční správy vám pošleme zvlášť, ať si vyberete, co vám sedí.

Kdybyste chtěli cokoli změnit nebo se na něco zeptat, stačí odpovědět.

S pozdravem
{{senderName}}
Webyz – weby pro místní firmy

---
Odhlásit se: {{unsubscribeUrl}}$tpl$ WHERE "key" = $tpl$offer_l2_default$tpl$;--> statement-breakpoint
UPDATE "email_templates" SET "name" = $tpl$L3 – nabídka měsíční správy webu$tpl$, "subject" = $tpl$Správa webu {{businessName}} – balíčky na míru$tpl$, "body" = $tpl$Dobrý den{{contactGreeting}},

děkujeme za odpověď! Podle vašeho rozpočtu jsme připravili tři varianty měsíční správy webu:

{{tierComparison}}

Doporučujeme {{packageName}} za {{monthlyPrice}} měsíčně – je v něm všechno a o web se nemusíte vůbec starat.

Stačí odpovědět, kterou variantu chcete, a o zbytek se postaráme. Správu můžete kdykoli zrušit s měsíční výpovědní lhůtou.

S pozdravem
{{senderName}}
Webyz – weby pro místní firmy

---
Odhlásit se: {{unsubscribeUrl}}$tpl$ WHERE "key" = $tpl$offer_l3_default$tpl$;--> statement-breakpoint
UPDATE "email_templates" SET "name" = $tpl$Upomínka 1 – přátelská připomínka (den 0)$tpl$, "subject" = $tpl$Připomínka platby za web {{websiteDomain}}$tpl$, "body" = $tpl$Dobrý den{{contactGreeting}},

jen přátelsky připomínáme platbu {{amount}} za správu webu {{websiteDomain}}, která byla splatná {{dueDate}}. Pokud jste už platili, považujte prosím tento e-mail za bezpředmětný.

S pozdravem
{{senderName}}
Webyz – weby pro místní firmy$tpl$ WHERE "key" = $tpl$dunning_1_default$tpl$;--> statement-breakpoint
UPDATE "email_templates" SET "name" = $tpl$Upomínka 2 – připomínka (den 3)$tpl$, "subject" = $tpl$Upomínka – platba za web {{websiteDomain}} je po splatnosti$tpl$, "body" = $tpl$Dobrý den{{contactGreeting}},

platba {{amount}} za správu webu {{websiteDomain}} je {{daysOverdue}} dní po splatnosti (splatná {{dueDate}}).

Děkujeme za brzkou úhradu.

S pozdravem
{{senderName}}
Webyz – weby pro místní firmy$tpl$ WHERE "key" = $tpl$dunning_2_default$tpl$;--> statement-breakpoint
UPDATE "email_templates" SET "name" = $tpl$Upomínka 3 – poslední výzva (den 7)$tpl$, "subject" = $tpl$Poslední výzva k úhradě – web {{websiteDomain}}$tpl$, "body" = $tpl$Dobrý den{{contactGreeting}},

platba {{amount}} za správu webu {{websiteDomain}} (splatná {{dueDate}}) stále nedorazila. Pokud ji neobdržíme do 3 dnů, budeme nuceni web dočasně pozastavit.

S pozdravem
{{senderName}}
Webyz – weby pro místní firmy$tpl$ WHERE "key" = $tpl$dunning_3_default$tpl$;--> statement-breakpoint
UPDATE "subscription_tiers" SET "description" = $tpl$Měsíční správa webu – web běží, je zabezpečený a zálohovaný.$tpl$, "features" = $tpl$["Hosting a doména","SSL certifikát (zabezpečení)","Pravidelné zálohy","Technické aktualizace a dohled","1 drobná úprava obsahu měsíčně"]$tpl$::jsonb WHERE "name" = $tpl$Základ$tpl$;--> statement-breakpoint
UPDATE "subscription_tiers" SET "description" = $tpl$Měsíční správa webu včetně pravidelných úprav obsahu.$tpl$, "features" = $tpl$["Hosting a doména","SSL certifikát (zabezpečení)","Pravidelné zálohy","Technické aktualizace a dohled","3 úpravy obsahu měsíčně (texty, fotky, ceník, otevírací doba)","Odpověď do 2 pracovních dnů"]$tpl$::jsonb WHERE "name" = $tpl$Standard$tpl$;--> statement-breakpoint
UPDATE "subscription_tiers" SET "description" = $tpl$Kompletní péče – o web se nemusíte vůbec starat.$tpl$, "features" = $tpl$["Hosting a doména","SSL certifikát (zabezpečení)","Pravidelné zálohy","Technické aktualizace a dohled","Neomezené drobné úpravy obsahu","Odpověď do 24 hodin","Péče o profil firmy na Google Mapách","Měsíční přehled návštěvnosti","Sezónní novinky a akce na webu"]$tpl$::jsonb WHERE "name" = $tpl$Premium$tpl$;
