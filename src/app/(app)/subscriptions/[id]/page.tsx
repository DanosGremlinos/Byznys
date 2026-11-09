import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DunningStepsView, RUN_STATUS_LABELS } from "@/components/billing/dunning-steps";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { addDays, daysOverdue } from "@/lib/dates";
import { formatCzk, formatDate, formatDateTime, pragueToday } from "@/lib/format";
import { EVENT_LABELS, SUBSCRIPTION_STATUS_LABELS, WEBSITE_STATUS_LABELS } from "@/lib/status-labels";
import { getSubscriptionDetail, listTiers } from "@/server/billing/queries";
import { pauseSubscriptionAction, suspendWebsiteAction } from "../actions";
import { CancelForm, PackageForm, PaymentForm } from "./forms";

export const metadata: Metadata = { title: "Předplatné" };

export default function SubscriptionDetailPage({ params }: PageProps<"/subscriptions/[id]">) {
  return (
    <>
      <Link
        href="/subscriptions"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-4" />
        Všechna předplatné
      </Link>
      <Suspense fallback={<Skeleton className="h-[600px] w-full" />}>
        <Detail params={params} />
      </Suspense>
    </>
  );
}

async function Detail({ params }: Pick<PageProps<"/subscriptions/[id]">, "params">) {
  const { id } = await params;
  const [sub, tiers] = await Promise.all([getSubscriptionDetail(id), listTiers()]);
  if (!sub) notFound();
  const today = pragueToday();
  const overdueDays = sub.status === "active" ? daysOverdue(sub.paidUntil, today) : 0;
  const cancelled = sub.status === "cancelled";

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{sub.client.businessName}</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {sub.website.domain ?? sub.website.name}
            {sub.website.liveUrl ? (
              <a
                href={sub.website.liveUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:underline"
              >
                <ExternalLink className="size-3" />
              </a>
            ) : null}
            <Badge variant="outline">Web: {WEBSITE_STATUS_LABELS[sub.website.status]}</Badge>
            <Badge variant={sub.status === "active" ? "secondary" : "outline"}>
              {SUBSCRIPTION_STATUS_LABELS[sub.status]}
            </Badge>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!cancelled ? (
            <form action={pauseSubscriptionAction.bind(null, sub.id, sub.status === "active")}>
              <Button type="submit" variant="outline" size="sm">
                {sub.status === "active" ? "Pozastavit předplatné" : "Obnovit předplatné"}
              </Button>
            </form>
          ) : null}
          <form action={suspendWebsiteAction.bind(null, sub.website.id, sub.website.status !== "suspended")}>
            <Button
              type="submit"
              variant={sub.website.status === "suspended" ? "default" : "outline"}
              size="sm"
            >
              {sub.website.status === "suspended" ? "Znovu spustit web" : "Pozastavit web"}
            </Button>
          </form>
          <Button asChild variant="outline" size="sm">
            <Link href={`/messaging/queue/new?client=${sub.clientId}`}>Poslat e-mail</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Platby</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <dl className="grid grid-cols-2 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Měsíčně</dt>
              <dd className="text-right tabular-nums">{formatCzk(sub.priceHalere)}</dd>
              <dt className="text-muted-foreground">Zaplaceno do</dt>
              <dd className={`text-right tabular-nums ${overdueDays ? "font-medium text-destructive" : ""}`}>
                {formatDate(sub.paidUntil)}
                {overdueDays ? ` · ${overdueDays} dní po splatnosti` : ""}
              </dd>
              <dt className="text-muted-foreground">Další platba</dt>
              <dd className="text-right tabular-nums">
                {cancelled ? "–" : formatDate(addDays(sub.paidUntil, 1))}
              </dd>
              <dt className="text-muted-foreground">Začátek</dt>
              <dd className="text-right tabular-nums">{formatDate(sub.startedOn)}</dd>
            </dl>
            <PaymentForm subscriptionId={sub.id} priceHalere={sub.priceHalere} disabled={cancelled} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Balíček</CardTitle>
          </CardHeader>
          <CardContent>
            <PackageForm
              subscriptionId={sub.id}
              current={{
                tierId: sub.tierId,
                name: sub.name,
                priceHalere: sub.priceHalere,
                features: sub.features,
              }}
              tiers={tiers.map((t) => ({
                id: t.id,
                name: t.name,
                monthlyPriceHalere: t.monthlyPriceHalere,
                features: t.features,
              }))}
              disabled={cancelled}
            />
          </CardContent>
        </Card>
      </div>

      {sub.dunningRuns.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Upomínky</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {sub.dunningRuns.map((run) => (
              <div key={run.id} className="grid gap-2">
                <p className="text-sm">
                  Neuhrazeno od {formatDate(addDays(run.missedPaidUntil, 1))} · {formatCzk(run.amountHalere)}{" "}
                  · <span className="font-medium">{RUN_STATUS_LABELS[run.status]}</span>
                </p>
                <DunningStepsView steps={run.steps} />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Historie</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-2 text-sm">
            {sub.events.map((e) => (
              <li key={e.id} className="flex flex-wrap justify-between gap-2 border-b pb-2 last:border-0">
                <span>
                  <span className="font-medium">{EVENT_LABELS[e.type] ?? e.type}</span>
                  {e.amountHalere !== null && e.type === "payment_received"
                    ? ` · ${formatCzk(e.amountHalere)}`
                    : ""}
                  {e.paidUntil ? ` · zaplaceno do ${formatDate(e.paidUntil)}` : ""}
                  {e.fromPriceHalere !== null && e.toPriceHalere !== null
                    ? ` · ${formatCzk(e.fromPriceHalere)} → ${formatCzk(e.toPriceHalere)}`
                    : ""}
                  {e.note ? <span className="text-muted-foreground"> · {e.note}</span> : null}
                </span>
                <time className="text-muted-foreground">{formatDateTime(e.occurredAt)}</time>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {!cancelled ? (
        <Card>
          <CardHeader>
            <CardTitle>Zrušení předplatného</CardTitle>
          </CardHeader>
          <CardContent>
            <CancelForm subscriptionId={sub.id} />
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
          Zrušeno {sub.cancelledAt ? formatDateTime(sub.cancelledAt) : ""}
          {sub.cancelReason ? ` – ${sub.cancelReason}` : ""}
        </p>
      )}
    </>
  );
}
