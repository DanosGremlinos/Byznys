import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCzk } from "@/lib/format";
import { listTiers } from "@/server/billing/queries";
import { TierForm } from "./tier-form";

export const metadata: Metadata = { title: "Tarify" };

export default function TiersPage() {
  return (
    <>
      <PageHeader
        title="Tarify"
        description="Šablony balíčků. Slouží jako výchozí hodnoty – každý klient má vlastní název, cenu a funkce předplatného. Používají se i ve srovnání v nabídce L3."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Tiers />
      </Suspense>
      <Card>
        <CardHeader>
          <CardTitle>Nová šablona balíčku</CardTitle>
        </CardHeader>
        <CardContent>
          <TierForm tier={null} />
        </CardContent>
      </Card>
    </>
  );
}

async function Tiers() {
  const tiers = await listTiers();
  return (
    <>
      {tiers.map((t) => (
        <Card key={t.id}>
          <CardHeader className="flex flex-row items-center gap-2">
            <CardTitle>{t.name}</CardTitle>
            <span className="text-sm text-muted-foreground">{formatCzk(t.monthlyPriceHalere)} / měsíc</span>
            {!t.isActive ? <Badge variant="outline">neaktivní</Badge> : null}
          </CardHeader>
          <CardContent>
            <TierForm tier={t} />
          </CardContent>
        </Card>
      ))}
    </>
  );
}
