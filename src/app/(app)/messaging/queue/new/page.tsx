import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/db";
import { formatCzk, formatDate } from "@/lib/format";
import { aiConfigured } from "@/server/ai/client";
import { listPackageOffers } from "@/server/billing/package-offers";
import { composeOptions } from "@/server/messaging/queries";
import { ComposeForm } from "./compose-form";

export const metadata: Metadata = { title: "Nová nabídka" };
export const maxDuration = 120;

export default function NewOfferPage({ searchParams }: PageProps<"/messaging/queue/new">) {
  return (
    <>
      <PageHeader
        title="Nová nabídka"
        description="Agent připraví e-mail z dat leadu nebo klienta. Odeslání vždy schvalujete vy."
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

async function Form({ searchParams }: Pick<PageProps<"/messaging/queue/new">, "searchParams">) {
  const sp = await searchParams;
  const [options, offers] = await Promise.all([composeOptions(), listPackageOffers(db)]);
  const initial =
    typeof sp.client === "string"
      ? `client:${sp.client}`
      : typeof sp.lead === "string"
        ? `lead:${sp.lead}`
        : "";
  return (
    <ComposeForm
      leads={options.leads}
      clients={options.clients}
      tiers={options.tiers.map((t) => ({ id: t.id, name: t.name, monthlyPriceHalere: t.monthlyPriceHalere }))}
      packageOffers={offers.map((o) => ({
        id: o.id,
        clientId: o.client.id,
        leadId: o.client.leadId,
        clientName: o.client.businessName,
        label: `${formatDate(o.createdAt)} · rozpočet ${formatCzk(o.budgetHalere)} → ${o.packages
          .map((p) => `${p.name} ${formatCzk(p.priceHalere)}${p.recommended ? " ★" : ""}`)
          .join(" / ")}${o.website ? ` (${o.website.domain ?? o.website.name})` : ""}`,
      }))}
      initialOfferId={typeof sp.offer === "string" ? sp.offer : ""}
      initialRecipient={initial}
      aiEnabled={aiConfigured()}
    />
  );
}
