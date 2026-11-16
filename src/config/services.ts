// Starting services list (same as initially set up in production) for the seed / tests. In the app the list is edited on the Balíčky page (table `services`).
// Prices are monthly, in whole Kč. `required` = always part of every package.
export const DEFAULT_SERVICES: { name: string; priceKc: number; required?: boolean; description?: string }[] =
  [
    {
      name: "Hosting webu",
      priceKc: 120,
      required: true,
      description: "Rychlý a spolehlivý provoz webu na serveru.",
    },
    {
      name: "Doména .cz (každoroční prodloužení)",
      priceKc: 30,
      required: true,
      description: "Hlídáme a platíme prodloužení domény, aby web nikdy nespadl.",
    },
    {
      name: "SSL certifikát a zabezpečení",
      priceKc: 50,
      required: true,
      description: "HTTPS, ochrana proti útokům, prohlížeč neukazuje „Nezabezpečeno“.",
    },
    {
      name: "Pravidelné zálohy webu",
      priceKc: 50,
      required: true,
      description: "Denní zálohy, web jde kdykoliv obnovit.",
    },
    {
      name: "Technická údržba a aktualizace",
      priceKc: 100,
      required: true,
      description: "Aktualizace systému a doplňků, oprava chyb.",
    },
    {
      name: "Drobné úpravy obsahu (až 2× měsíčně)",
      priceKc: 200,
      description: "Změna textů, fotek, otevírací doby nebo cen na požádání.",
    },
    {
      name: "Správa profilu Firmy na Googlu",
      priceKc: 250,
      description: "Aktuální údaje, fotky a odpovědi na recenze v Google Mapách.",
    },
    {
      name: "Kontaktní formulář s ochranou proti spamu",
      priceKc: 50,
      description: "Zprávy chodí rovnou do e-mailu, bez spamu.",
    },
    {
      name: "Základní SEO (nastavení pro vyhledávače)",
      priceKc: 150,
      description: "Titulky, popisy a struktura, aby web našel Google.",
    },
    {
      name: "Recenze z Googlu přímo na webu",
      priceKc: 100,
      description: "Nejlepší recenze se na webu zobrazují automaticky.",
    },
    {
      name: "Měsíční přehled návštěvnosti",
      priceKc: 100,
      description: "Kolik lidí web navštívilo a odkud přišli – jednou měsíčně e-mailem.",
    },
    {
      name: "Firemní e-mail na vlastní doméně",
      priceKc: 100,
      description: "Např. info@vasefirma.cz místo Gmailu.",
    },
    {
      name: "Online menu / ceník s průběžnou aktualizací",
      priceKc: 150,
      description: "Menu nebo ceník na webu vždy aktuální.",
    },
    {
      name: "Galerie fotek s průběžným doplňováním",
      priceKc: 100,
      description: "Nové fotky provozovny, jídel nebo práce.",
    },
    {
      name: "Propojení se sociálními sítěmi",
      priceKc: 100,
      description: "Odkazy a příspěvky z Instagramu / Facebooku na webu.",
    },
    {
      name: "Monitoring dostupnosti webu 24/7",
      priceKc: 50,
      description: "Když web spadne, víme o tom dřív než zákazník.",
    },
    {
      name: "Cookie lišta a soulad s GDPR",
      priceKc: 50,
      description: "Souhlas s cookies a zásady ochrany osobních údajů.",
    },
    {
      name: "Prioritní podpora (odezva do 24 hodin)",
      priceKc: 150,
      description: "Požadavky řešíme přednostně.",
    },
    {
      name: "Online rezervace / objednávky",
      priceKc: 300,
      description: "Rezervace termínů nebo stolů, případně objednávky přímo z webu.",
    },
    {
      name: "Blog / sekce novinek",
      priceKc: 150,
      description: "Akce, novinky a články – vložíme je za vás.",
    },
    { name: "Vícejazyčná verze (angličtina)", priceKc: 250, description: "Web i pro zahraniční zákazníky." },
    {
      name: "Čtvrtletní konzultace a návrhy na zlepšení",
      priceKc: 200,
      description: "Jednou za čtvrt roku projdeme výsledky a navrhneme vylepšení.",
    },
  ];

/** Names of the three calculated packages, cheapest first. */
export const PACKAGE_NAMES = ["Základ", "Standard", "Premium"] as const;
