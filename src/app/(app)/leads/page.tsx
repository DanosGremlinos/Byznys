import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Leady" };

export default function Page() {
  return (
    <>
      <PageHeader title="Leady" description="Vyhledávání a hodnocení potenciálních klientů." />
      <ComingSoon
        phase={1}
        items={[
          "Vyhledávání podle kategorie a města (Google Places API) na pozadí",
          "Analýza webu a PageSpeed, skóre příležitosti 0–100 s viditelnými faktory",
          "Akce Postavit web → Builder s předvyplněnými daty",
        ]}
      />
    </>
  );
}
