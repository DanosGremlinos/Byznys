import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Šablony" };

export default function Page() {
  return (
    <>
      <PageHeader title="Šablony" description="E-mailové šablony a šablona smlouvy." />
      <ComingSoon
        phase={2}
        items={["Šablony L1 / L2 / L3 a upomínek", "Editovatelná šablona smlouvy (PDF)"]}
      />
    </>
  );
}
