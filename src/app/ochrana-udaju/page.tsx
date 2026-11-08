import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { identityLine, leadRetentionDays, providerIdentity } from "@/lib/legal";
import { addressOf } from "@/server/email/render";

export const metadata: Metadata = { title: "Zásady ochrany osobních údajů" };

/**
 * Public privacy notice (GDPR art. 13 and 14). Linked from every outgoing email. The identity comes
 * from PROVIDER_* env vars; nothing here is invented.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-sm leading-relaxed">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Zásady ochrany osobních údajů</h1>
      <Suspense fallback={<p className="text-muted-foreground">Načítám…</p>}>
        <Content />
      </Suspense>
    </main>
  );
}

const H = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mt-6 mb-2 text-base font-semibold">{children}</h2>
);

async function Content() {
  await connection(); // env vars are read at request time
  const id = providerIdentity();
  const from = process.env.EMAIL_FROM;
  const contact = process.env.PRIVACY_CONTACT_EMAIL || (from ? addressOf(from) : null);
  const days = leadRetentionDays();
  return (
    <div className="grid gap-1">
      <H>Správce</H>
      <p>
        {id.ok ? identityLine(id.identity) : "Údaje o správci zatím nejsou doplněny."}
        {contact ? (
          <>
            {" "}
            Kontakt: <a href={`mailto:${contact}`}>{contact}</a>.
          </>
        ) : null}
      </p>

      <H>Jaké údaje zpracovávám a odkud je mám</H>
      <ul className="list-disc pl-5">
        <li>
          Veřejně dostupné údaje o podnicích: název, adresa, telefon, e-mail, otevírací doba, odkazy na
          sociální sítě, hodnocení a fotografie – z webových stránek podniku a ze služby Google Maps.
        </li>
        <li>Jméno kontaktní osoby, pokud je uvedeno na webu podniku nebo mi ho sdělíte.</li>
        <li>Obsah naší vzájemné komunikace.</li>
        <li>U klientů navíc fakturační a smluvní údaje.</li>
      </ul>

      <H>Proč a na jakém právním základě</H>
      <ul className="list-disc pl-5">
        <li>
          Nabídka tvorby webových stránek podnikům: oprávněný zájem (čl. 6 odst. 1 písm. f GDPR). Nabídku
          e-mailem posílám jen se souhlasem nebo jako odpověď na vaši zprávu (zákon č. 480/2004 Sb.).
        </li>
        <li>Uzavření a plnění smlouvy: čl. 6 odst. 1 písm. b GDPR.</li>
        <li>Účetní a daňové povinnosti: čl. 6 odst. 1 písm. c GDPR.</li>
      </ul>

      <H>Jak dlouho</H>
      <ul className="list-disc pl-5">
        <li>
          Údaje o podnicích, které nedaly souhlas a nejsou klienty: nejdéle {days} dní od poslední aktivity,
          pak se automaticky mažou.
        </li>
        <li>Klienti: po dobu smlouvy a poté po dobu, kterou ukládají účetní a daňové předpisy.</li>
        <li>Odhlášené adresy: trvale na seznamu blokovaných adres, abych vám znovu nepsal.</li>
      </ul>

      <H>Komu údaje předávám</H>
      <p>
        Poskytovatelům, kteří pro mě zajišťují provoz: hosting a databáze (Vercel, Neon), odesílání e-mailů
        (Mailgun) a pomoc s psaním textů (Anthropic). Někteří z nich mohou údaje zpracovávat i mimo EU, vždy
        na základě standardních smluvních doložek nebo rozhodnutí o odpovídající ochraně.
      </p>

      <H>Vaše práva</H>
      <p>
        Máte právo na přístup ke svým údajům, jejich opravu, výmaz, omezení zpracování a přenositelnost a
        právo vznést námitku proti zpracování, včetně přímého marketingu – pak vás už neoslovím. Stačí napsat
        {contact ? (
          <>
            {" "}
            na <a href={`mailto:${contact}`}>{contact}</a>
          </>
        ) : null}{" "}
        nebo kliknout na odkaz pro odhlášení v e-mailu. Stížnost můžete podat u Úřadu pro ochranu osobních
        údajů (www.uoou.gov.cz).
      </p>
    </div>
  );
}
