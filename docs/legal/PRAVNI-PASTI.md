# Šest právních pastí v aplikaci

Opravy jsou přímo v kódu (větev `claude/charming-noether-cwusyd`). Pravidla jsou i v zadání (`SPEC.md`, sekce `<legal>`).

> Nejsem advokát. Tohle je kontrolní seznam s odkazy na předpisy, ne právní stanovisko. Před ostrou kampaní a první smlouvou doporučuju nechat šablonu smlouvy a stránku `/ochrana-udaju` projít advokátem.

| # | Past | Co hrozilo | Co teď dělá aplikace |
|---|------|------------|----------------------|
| 1 | **Nabídkové e-maily bez souhlasu** (zák. 480/2004 Sb., § 7) | L1 nabídka studeným leadům. V ČR je u e-mailu potřeba předchozí souhlas i u firem. Pokuty uděluje ÚOOÚ. | Nabídku leadu bez souhlasu nejde odeslat (zůstane ve frontě). Souhlas zapíšeš v detailu leadu po telefonu nebo osobní návštěvě. Výjimka: lead napsal první, nebo už je klient. |
| 2 | **Chybějící identifikace odesílatele** (§ 435 OZ) | E-maily bez jména, IČO a sídla. | Každý e-mail má patičku s identifikací a odkazem na zásady, nabídky jsou označené „obchodní sdělení“. Bez `PROVIDER_NAME`, `PROVIDER_ICO`, `PROVIDER_ADDRESS` se nic neodešle. |
| 3 | **GDPR u leadů** | OSVČ a kontaktní osoby jsou osobní údaje; chyběly zásady, výmaz i doba uložení. | Veřejná stránka `/ochrana-udaju`, export a výmaz leadu, automatické mazání leadů bez souhlasu po 180 dnech nečinnosti. |
| 4 | **Autorská práva k fotkám, logu a recenzím** | Fotky a logo z cizího webu a recenze od zákazníků šly rovnou do zadání webu. | V Builderu je u každého podkladu „Práva OK“. Nepotvrzené jsou v promptu označené jen pro neveřejný náhled. Ukládání dat z Google Places zůstává podle tvého rozhodnutí. |
| 5 | **Pozastavení webu a vymáhání** | Web šel pozastavit kdykoli; smlouva neřešila DPH, poplatky, doménu ani zpracování dat z formulářů. | Pozastavit jde až 3 dny po odeslání poslední výzvy. Výchozí šablona smlouvy má body o DPH, úrocích a nákladech podle NV 351/2013 Sb., pozastavení, doméně a licenci, zpracování osobních údajů a odpovědnosti. |
| 6 | **Weby pro klienty** | Weby bez zásad ochrany údajů, s cookies z map a fontů a se zbytečným souhlasovým políčkem. | Prompt z Builderu obsahuje „Právní minimum webu“: identifikace v patičce, zásady, cookie lišta jen při analytice, u e-shopu obchodní podmínky a 14denní odstoupení. |

## Co musíš doplnit ty

Všechna místa označená `[DOPLNIT]`:

- Proměnné prostředí `PROVIDER_NAME`, `PROVIDER_ICO`, `PROVIDER_ADDRESS` (a volitelně `PROVIDER_REGISTER`, `PRIVACY_CONTACT_EMAIL`) ve Vercelu – bez nich se e-maily neodešlou
- `content/legal/ochrana-udaju.md` – delší šablona zásad, pokud chceš text na `/ochrana-udaju` rozšířit
- `content/legal/lia.md` – test oprávněného zájmu pro databázi leadů
- `content/legal/smlouva-sablona.md` – šablona smlouvy o tvorbě a provozu webu
- `docs/legal/processors.md` – zpracovatelé, region a odkazy na DPA (po výběru e-mailového a platebního poskytovatele)

## Pokud jsi „6 pastí“ myslel jinak

Pokud máš na mysli konkrétní seznam (článek, video, checklist), pošli ho a zadání podle něj upravím.
