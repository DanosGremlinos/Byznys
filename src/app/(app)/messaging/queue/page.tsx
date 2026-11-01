import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Ke schválení" };

export default function Page() {
  return (
    <>
      <PageHeader title="Ke schválení" description="Odchozí e-maily čekající na schválení." />
      <ComingSoon
        phase={2}
        items={[
          "Fronta všech odchozích e-mailů – nic se neodešle bez schválení",
          "Úprava a odeslání, blokace adres na blacklistu",
        ]}
      />
    </>
  );
}
