# Šest právních pastí v zadání aplikace

Aplikace zatím existuje jen jako zadání (`SPEC.md`). Tyto pasti v něm byly zabudované a opravené jsou přímo v zadání (sekce `<legal>`, body L1–L6), aby je aplikace hlídala v kódu od fáze 0.

> Nejsem advokát. Tohle je kontrolní seznam s odkazy na předpisy, ne právní stanovisko. Před spuštěním ostré kampaně a před podpisem první smlouvy doporučuju nechat šablony v `content/legal/` projít advokátem.

| # | Past | Co v zadání hrozilo | Oprava v zadání |
|---|------|---------------------|-----------------|
| 1 | **Nevyžádaná obchodní sdělení** (zák. 480/2004 Sb., § 7) | L1 nabídkový e-mail chodí studeným leadům. V ČR je u e-mailu potřeba předchozí souhlas i u firem; výjimka je jen pro vlastní zákazníky. Pokuty uděluje ÚOOÚ. | Lead má `contact_basis`; bez souhlasu se nabídka nedá odeslat. První kontakt telefonem / osobně, souhlas se zaznamená přes odkaz `/souhlas/…`. |
| 2 | **GDPR u leadů** | OSVČ, kontaktní osoby, jejich e-maily a telefony jsou osobní údaje. Zadání je chtělo ukládat bez právního základu, bez informační povinnosti a bez výmazu. | Oprávněný zájem s testem (`lia.md`), veřejná stránka `/ochrana-udaju`, automatická anonymizace po 6 měsících, export a výmaz, seznam zpracovatelů (Anthropic, e-mail, platby, Neon, Vercel). |
| 3 | **Podmínky Google Places API** | Ukládat napořád fotky, recenze a údaje z Places a používat je na webech klientů podmínky Google Maps Platform nepovolují. | Trvale jen `place_id`, ostatní max. 30 dní a obnovit / smazat. Fotky a recenze z Places nikdy do Blobu ani do promptu. |
| 4 | **Autorská práva k fotkám, logu a recenzím** | Fotky a texty z cizích webů a recenze od zákazníků (autory jsou recenzenti) se měly rovnou použít na novém webu. | Každý podklad má `rights_status`. Do ostrého promptu jen schválené podklady; demo je neveřejné, `noindex`, s vodoznakem a vyprší. Reference jen se souhlasem. |
| 5 | **Identifikace podnikatele** (OZ § 435) | E-maily, smlouvy a faktury musí obsahovat jméno, IČO, sídlo a zápis v rejstříku. V zadání nebylo nic. | Údaje se zadají jednou v `/nastaveni/firma` a vkládají se všude; bez nich odeslání selže. |
| 6 | **Smlouva, předplatné a vymáhání** | Hrozba „pozastavíme web“ bez opory ve smlouvě, nejasné vlastnictví webu a domény, poplatky z prodlení „od oka“, chybějící zpracovatelská smlouva (hostuješ data z formulářů klientů). Navíc weby pro klienty neměly cookie lištu ani zásady. | Šablona smlouvy s povinnými body, varování o pozastavení jen při `allows_suspension`, pozastavení vždy ručně, poplatky podle NV 351/2013 Sb. Builder přidává do každého webu blok „Právní minimum webu“. |

> **Bod 3:** v `PROGRESS.md` je tvoje rozhodnutí ukládat recenze a fotky z Places natrvalo. V zadání je proto pravidlo L3 jen jako vyhovující alternativa, ne k implementaci. Riziko je porušení podmínek Google (zablokování API klíče), ne pokuta od státu.

## Co musíš doplnit ty

Všechna místa označená `[DOPLNIT]`:

- `content/legal/ochrana-udaju.md` – zásady ochrany osobních údajů (stránka `/ochrana-udaju`)
- `content/legal/lia.md` – test oprávněného zájmu pro databázi leadů
- `content/legal/smlouva-sablona.md` – šablona smlouvy o tvorbě a provozu webu
- `docs/legal/processors.md` – zpracovatelé, region a odkazy na DPA (po výběru e-mailového a platebního poskytovatele)

## Pokud jsi „6 pastí“ myslel jinak

Pokud máš na mysli konkrétní seznam (článek, video, checklist), pošli ho a zadání podle něj upravím.
