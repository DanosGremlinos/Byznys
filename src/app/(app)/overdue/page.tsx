import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Neuhrazené platby" };

export default function Page() {
  return (
    <>
      <PageHeader title="Neuhrazené platby" description="Faktury po splatnosti a upomínky." />
      <ComingSoon
        phase={3}
        items={[
          "Filtry a řazení: částka, dny po splatnosti, klient",
          "Upomínky den 0 / 3 / 7 přes frontu ke schválení, pozastavení pro každého klienta",
        ]}
      />
    </>
  );
}
