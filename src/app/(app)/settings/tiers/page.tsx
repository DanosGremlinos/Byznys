import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Tarify" };

export default function Page() {
  return (
    <>
      <PageHeader title="Tarify" description="Nastavení tarifů předplatného." />
      <ComingSoon phase={3} items={["Název, měsíční cena a funkce tarifu"]} />
    </>
  );
}
