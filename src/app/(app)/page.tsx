import type { Metadata } from "next";
import { Suspense } from "react";
import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getDatabaseOverview } from "@/server/overview";

export const metadata: Metadata = { title: "Přehled" };

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Přehled" description="Weby, předplatné, leady a nabídky na jednom místě." />
      <ComingSoon
        phase={1}
        items={[
          "Statistiky: aktivní weby, předplatné, MRR, nové leady, nabídky, míra odpovědí a konverze",
          "Dlaždice webů s předplatným, rychlými akcemi a počtem nepřečtených e-mailů",
          "Historie prodejů a předplatného, graf tržeb (měsíčně / ročně)",
        ]}
      />
      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <DatabaseOverview />
      </Suspense>
    </>
  );
}

async function DatabaseOverview() {
  const rows = await getDatabaseOverview();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Stav databáze</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {rows.map((row) => (
            <div key={row.label} className="grid gap-1">
              <dt className="text-xs text-muted-foreground">{row.label}</dt>
              <dd className="text-xl font-semibold tabular-nums">{row.count}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
