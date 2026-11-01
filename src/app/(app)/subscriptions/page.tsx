import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Předplatné" };

export default function Page() {
  return (
    <>
      <PageHeader title="Předplatné" description="Aktivní předplatné a blížící se obnovy." />
      <ComingSoon
        phase={3}
        items={[
          "Upgrade / downgrade / zrušení s historií",
          "Seznam blížících se obnov",
          "Ruční zaznamenání platby",
        ]}
      />
    </>
  );
}
