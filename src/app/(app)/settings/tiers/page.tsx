import type { Metadata } from "next";
import { Suspense } from "react";
import { PackageOffersTable } from "@/components/billing/package-offers-table";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/db";
import { requireAdmin } from "@/lib/auth-guard";
import { formatCzk } from "@/lib/format";
import { listTiers } from "@/server/billing/queries";
import { calculatorOptions, listPackageOffers } from "@/server/billing/package-offers";
import { PackageCalculator } from "./package-calculator";
import { TierForm } from "./tier-form";

export const metadata: Metadata = { title: "Tarify" };

export default function TiersPage({ searchParams }: PageProps<"/settings/tiers">) {
  return (
    <>
      <PageHeader
        title="Tarify"
        description="Kalkulačka složí z rozpočtu klienta 3 balíčky tak, aby se vyplatilo vzít ten největší. Obsah balíčků určují šablony dole."
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
      <h2 className="mt-2 text-lg font-semibold">Šablony balíčků</h2>
      <p className="-mt-2 text-sm text-muted-foreground">
        Kalkulačka bere první 3 aktivní šablony podle pořadí (Základ → Standard → Premium) a jejich funkce. Aby
        návnada fungovala, má Premium obsahovat vše ze Standardu a navíc 2–3 viditelné věci. Výchozí cena se
        použije jen při zakládání předplatného bez kalkulačky.
      </p>
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
