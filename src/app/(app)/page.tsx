import type { Metadata } from "next";
import { Suspense } from "react";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { WebsiteTiles } from "@/components/dashboard/website-tiles";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCzk, formatDate, formatDateTime, pragueToday } from "@/lib/format";
import { EVENT_LABELS } from "@/lib/status-labels";
import { getDashboardStats, getRevenue, getTimeline, getWebsiteTiles } from "@/server/dashboard";
import { openWebsiteInBuilder } from "./builder/actions";

export const metadata: Metadata = { title: "Přehled" };

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Přehled" description="Weby, předplatné, leady a nabídky na jednom místě." />
      <Suspense fallback={<Skeleton className="h-28 w-full" />}>
        <Stats />
      </Suspense>
      <Card>
        <CardHeader>
          <CardTitle>Weby</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <Tiles />
          </Suspense>
        </CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Tržby</CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<Skeleton className="h-64 w-full" />}>
              <Revenue />
            </Suspense>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Historie</CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<Skeleton className="h-64 w-full" />}>
              <Timeline />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

const pct = (v: number | null) => (v === null ? "–" : `${Math.round(v * 100)} %`);

async function Stats() {
  const s = await getDashboardStats();
  const items = [
    { label: "Aktivní weby", value: String(s.activeWebsites) },
    { label: "Aktivní předplatné", value: String(s.activeSubscriptions) },
    { label: "MRR", value: formatCzk(s.mrrHalere) },
    { label: "Nové leady (7 dní)", value: String(s.newLeadsWeek) },
    { label: "Odeslané nabídky (30 dní)", value: String(s.offersSent30d) },
    {
      label: "Míra odpovědí",
      value: pct(s.replyRate),
      hint: "Podíl vláken s nabídkou, na která klient odpověděl",
    },
    { label: "Konverze", value: pct(s.conversionRate), hint: "Klienti / oslovené leady" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
      {items.map((i) => (
        <div key={i.label} className="grid gap-1 rounded-xl border bg-card p-4 shadow-sm" title={i.hint}>
          <span className="text-xs text-muted-foreground">{i.label}</span>
          <span className="text-2xl font-semibold tabular-nums">{i.value}</span>
        </div>
      ))}
    </div>
  );
}

async function Tiles() {
  const tiles = await getWebsiteTiles();
  return <WebsiteTiles tiles={tiles} today={pragueToday()} openInBuilder={openWebsiteInBuilder} />;
}

async function Revenue() {
  const { monthly, yearly } = await getRevenue();
  return <RevenueChart monthly={monthly} yearly={yearly} />;
}

async function Timeline() {
  const events = await getTimeline();
  if (!events.length) return <p className="text-sm text-muted-foreground">Zatím žádné události.</p>;
  return (
    <ol className="grid max-h-96 gap-3 overflow-auto pr-2">
      {events.map((e) => (
        <li key={e.id} className="grid grid-cols-[auto_1fr] gap-3 text-sm">
          <span className="mt-1.5 size-2 rounded-full bg-muted-foreground/40" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
              <span className="font-medium">{EVENT_LABELS[e.type] ?? e.type}</span>
              <time className="text-xs text-muted-foreground">{formatDateTime(e.occurredAt)}</time>
            </div>
            <p className="truncate text-muted-foreground">
              {e.clientName} · {e.subscriptionName}
              {e.type === "payment_received" && e.amountHalere !== null
                ? ` · ${formatCzk(e.amountHalere)}${e.paidUntil ? `, zaplaceno do ${formatDate(e.paidUntil)}` : ""}`
                : null}
              {(e.type === "upgraded" || e.type === "downgraded") &&
              e.fromPriceHalere !== null &&
              e.toPriceHalere !== null
                ? ` · ${formatCzk(e.fromPriceHalere)} → ${formatCzk(e.toPriceHalere)}`
                : null}
              {e.type === "created" && e.toPriceHalere !== null
                ? ` · ${formatCzk(e.toPriceHalere)} / měs.`
                : null}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
