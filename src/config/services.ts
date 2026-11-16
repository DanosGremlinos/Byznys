// Example services for the seed / tests. In the app the list is edited on the Balíčky page (table `services`).
// Prices are monthly, in whole Kč. `required` = always part of every package.
export const DEFAULT_SERVICES: { name: string; priceKc: number; required?: boolean; description?: string }[] = [
  { name: "Hosting a doména", priceKc: 150, required: true },
  { name: "SSL certifikát a zabezpečení", priceKc: 50, required: true },
  { name: "Zálohy webu", priceKc: 50, required: true },
  { name: "Drobné úpravy obsahu (2× měsíčně)", priceKc: 250 },
  { name: "Kontaktní formulář", priceKc: 50 },
  { name: "Galerie a ceník", priceKc: 100 },
  { name: "Základní SEO", priceKc: 150 },
  { name: "Měsíční report návštěvnosti", priceKc: 100 },
  { name: "Rezervační systém", priceKc: 250 },
  { name: "Prioritní podpora", priceKc: 150 },
  { name: "Vícejazyčná verze", priceKc: 200 },
];

/** Names of the three calculated packages, cheapest first. */
export const PACKAGE_NAMES = ["Základ", "Standard", "Premium"] as const;
