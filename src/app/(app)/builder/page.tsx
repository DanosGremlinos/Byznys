import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Builder" };

export default function Page() {
  return (
    <>
      <PageHeader title="Builder" description="Sestavení promptu pro Claude Code z dat klienta." />
      <ComingSoon
        phase={1}
        items={[
          "Formulář klienta, podklady (fotky, logo, recenze, vlastní soubory)",
          "Struktura webu, styl, vlastní instrukce",
          "Vygenerovat prompt, kopírovat, verze promptů",
        ]}
      />
    </>
  );
}
