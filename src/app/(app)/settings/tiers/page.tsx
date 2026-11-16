import type { Metadata } from "next";
import { Suspense } from "react";
import { PackageOffersTable } from "@/components/billing/package-offers-table";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/db";
import { requireAdmin } from "@/lib/auth-guard";
import { formatCzk } from "@/lib/format";
import { calculatorOptions, listPackageOffers } from "@/server/billing/package-offers";
import { listServices } from "@/server/billing/services";
import { PackageCalculator } from "./package-calculator";
import { ServiceForm } from "./service-form";

export const metadata: Metadata = { title: "Balíčky" };

export default function TiersPage({ searchParams }: PageProps<"/settings/tiers">) {
  return (
    <>
      <PageHeader
        title="Balíčky"
        description="Kalkulačka složí ze služeb a rozpočtu klienta 3 balíčky tak, aby se vyplatilo vzít ten největší. Služby a jejich ceny nastavíte dole."
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
      <Card>
        <CardHeader>
          <CardTitle>Služby</CardTitle>
          <CardDescription>
            Všechny služby, které nabízíte, s měsíční cenou. Kalkulačka z nich skládá balíčky: povinné služby jsou ve
            všech, ostatní přidává podle pořadí (nižší číslo = důležitější), dokud se vejdou do rozpočtu. Cena
            balíčku = součet služeb, zaokrouhlený na …90 Kč.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <Services />
          </Suspense>
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
      services={options.services}
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

async function Services() {
  await requireAdmin();
  const rows = await listServices(db);
  const active = rows.filter((r) => r.isActive);
  const total = active.reduce((sum, r) => sum + r.monthlyPriceHalere, 0);
  const requiredTotal = active.filter((r) => r.required).reduce((sum, r) => sum + r.monthlyPriceHalere, 0);
  return (
    <>
      <p className="text-sm text-muted-foreground">
        Povinné služby celkem {formatCzk(requiredTotal)} / měsíc · všechny nabízené služby {formatCzk(total)} / měsíc.
      </p>
      {rows.map((r) => (
        <ServiceForm key={`${r.id}:${r.updatedAt.getTime()}`} service={r} />
      ))}
      <div className="rounded-md border border-dashed p-3">
        <p className="mb-3 text-sm font-medium">Nová služba</p>
        <ServiceForm service={null} nextSortOrder={(rows.at(-1)?.sortOrder ?? 0) + 10} />
      </div>
    </>
  );
}
