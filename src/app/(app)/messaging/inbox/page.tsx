import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Doručená pošta" };

export default function Page() {
  return (
    <>
      <PageHeader title="Doručená pošta" description="Odpovědi klientů a leadů." />
      <ComingSoon
        phase={2}
        items={[
          "Vlákna propojená s klientem",
          "Klasifikace odpovědí agentem (zájem / nezájem / dotaz / požadavek na změnu) s možností přepsání",
        ]}
      />
    </>
  );
}
