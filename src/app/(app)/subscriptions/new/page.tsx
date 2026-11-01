import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { addDays } from "@/lib/dates";
import { pragueToday } from "@/lib/format";
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
  const options = await newSubscriptionOptions();
  const today = pragueToday();
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
      initialClientId={typeof sp.client === "string" ? sp.client : ""}
      today={today}
      dayBefore={addDays(today, -1)}
    />
  );
}
