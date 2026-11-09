import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { addDays } from "@/lib/dates";
import { formatCzk, formatDate, pragueToday } from "@/lib/format";
import { db } from "@/db";
import { listPackageOffers } from "@/server/billing/package-offers";
import { newSubscriptionOptions } from "@/server/billing/queries";
import { NewSubscriptionForm } from "./form";

export const metadata: Metadata = { title: "Nové předplatné" };

export default function NewSubscriptionPage({ searchParams }: PageProps<"/subscriptions/new">) {
  return (
    <>
      <PageHeader
        title="Nové předplatné"
        description="Klient souhlasil – založte mu předplatné. Cena a funkce můžou být pro každého klienta jiné."
      />
      <Card>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <Form searchParams={searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </>
  );
}

async function Form({ searchParams }: Pick<PageProps<"/subscriptions/new">, "searchParams">) {
  const sp = await searchParams;
  const [options, offers] = await Promise.all([newSubscriptionOptions(), listPackageOffers(db)]);
  const today = pragueToday();
  // "Vytvořit předplatné" from saved calculator packages: preselect that package.
  const offer = typeof sp.offer === "string" ? offers.find((o) => o.id === sp.offer) : undefined;
  const pkgIndex = Number(sp.pkg);
  const initialPackage =
    offer && Number.isInteger(pkgIndex) && offer.packages[pkgIndex] ? `offer:${offer.id}:${pkgIndex}` : "";
  return (
    <NewSubscriptionForm
      clients={options.clients}
      websites={options.websites}
      tiers={options.tiers.map((t) => ({
        id: t.id,
        name: t.name,
        monthlyPriceHalere: t.monthlyPriceHalere,
        features: t.features,
      }))}
      offers={offers.map((o) => ({
        id: o.id,
        clientId: o.client.id,
        clientName: o.client.businessName,
        websiteId: o.website?.id ?? null,
        label: `${formatDate(o.createdAt)} · rozpočet ${formatCzk(o.budgetHalere)}`,
        packages: o.packages,
      }))}
      initialClientId={offer?.client.id ?? (typeof sp.client === "string" ? sp.client : "")}
      initialWebsiteId={offer?.website?.id ?? (typeof sp.website === "string" ? sp.website : "")}
      initialPackage={initialPackage}
      today={today}
      dayBefore={addDays(today, -1)}
    />
  );
}
