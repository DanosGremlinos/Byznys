import type { Metadata } from "next";
import { Suspense } from "react";
import { PackageOffersTable } from "@/components/billing/package-offers-table";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/db";
import { requireAdmin } from "@/lib/auth-guard";
import { listTiers } from "@/server/billing/queries";
import { calculatorOptions, listPackageOffers } from "@/server/billing/package-offers";
import { PackageCalculator } from "./package-calculator";
import { TierForm } from "./tier-form";

export const metadata: Metadata = { title: "Balíčky" };

export default function TiersPage({ searchParams }: PageProps<"/settings/tiers">) {
  return (
    <>
      <PageHeader
        title="Balíčky"
        description="Kalkulačka složí z rozpočtu klienta 3 balíčky tak, aby se vyplatilo vzít ten největší. Co který balíček obsahuje, nastavíte dole v Obsahu balíčků."
      />
      <Card>
        <CardHeader>
          <CardTitle>Kalkulačka balíčků</CardTitle>
          <CardDescription>
            Premium je kousek nad rozpočtem klienta, Standard jen o málo levnější (ale bez několika věcí) a Základ
            výrazně levnější a holý – jako popcorn v kině.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <Calculator searchParams={searchParams} />
          </Suspense>
        </CardContent>
      </Card>
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Uložené balíčky</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-32 w-full" />}>
            <Offers />
          </Suspense>
        </CardContent>
      </Card>
      <h2 className="mt-2 text-lg font-semibold">Obsah balíčků</h2>
      <p className="-mt-2 text-sm text-muted-foreground">
        Kalkulačka bere první 3 aktivní balíčky podle pořadí (Základ → Standard → Premium) a jejich obsah; ceny
        spočítá z rozpočtu klienta. Aby návnada fungovala, má Premium obsahovat vše ze Standardu a navíc 2–3
        viditelné věci.
      </p>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Tiers />
      </Suspense>
      <Card>
        <CardHeader>
          <CardTitle>Nový balíček</CardTitle>
        </CardHeader>
        <CardContent>
          <TierForm tier={null} />
        </CardContent>
      </Card>
    </>
  );
}

async function Calculator({ searchParams }: Pick<PageProps<"/settings/tiers">, "searchParams">) {
  await requireAdmin();
  const sp = await searchParams;
  const options = await calculatorOptions(db);
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return (
    <PackageCalculator
      templates={options.templates}
      clients={options.clients}
      websites={options.websites}
      initialClientId={str(sp.client)}
      initialWebsiteId={str(sp.website)}
      initialBudget={str(sp.budget)}
    />
  );
}

async function Offers() {
  await requireAdmin();
  return <PackageOffersTable offers={await listPackageOffers(db)} />;
}

async function Tiers() {
  const tiers = await listTiers();
  return (
    <>
      {tiers.map((t) => (
        <Card key={t.id}>
          <CardHeader className="flex flex-row items-center gap-2">
            <CardTitle>{t.name}</CardTitle>
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
