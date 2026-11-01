import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Statistiky" };

export default function Page() {
  return (
    <>
      <PageHeader title="Statistiky" description="Odeslané e-maily a míra odpovědí." />
      <ComingSoon phase={2} items={["Statistiky odeslání a odpovědí podle úrovně nabídky"]} />
    </>
  );
}
