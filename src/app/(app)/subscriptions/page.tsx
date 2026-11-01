import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { addDays } from "@/lib/dates";
import { formatCzk, formatDate, pragueToday } from "@/lib/format";
import { SUBSCRIPTION_STATUS_LABELS } from "@/lib/status-labels";
import { cn } from "@/lib/utils";
import { listSubscriptions, listTiers, upcomingRenewals } from "@/server/billing/queries";

export const metadata: Metadata = { title: "Předplatné" };

export default function SubscriptionsPage({ searchParams }: PageProps<"/subscriptions">) {
  return (
    <>
      <PageHeader
        title="Předplatné"
        description="Předplatné klientů, jejich balíčky a platby. Platby probíhají mimo aplikaci – tady je jen zaznamenáváte."
        actions={
          <Button asChild>
            <Link href="/subscriptions/new">
              <Plus />
              Nové předplatné
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <Renewals />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <List searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Renewals() {
  const rows = await upcomingRenewals(30);
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Blížící se platby (30 dní){" "}
          <span className="font-normal text-muted-foreground">({rows.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">V příštích 30 dnech nic.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/subscriptions/${r.id}`}
                  className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm hover:bg-accent"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{r.clientName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {r.domain ?? r.websiteName}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block tabular-nums">{formatDate(r.nextPayment)}</span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {formatCzk(r.priceHalere)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

const one = (v: string | string[] | undefined) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

async function List({ searchParams }: Pick<PageProps<"/subscriptions">, "searchParams">) {
  const sp = await searchParams;
  const filters = { q: one(sp.q), status: one(sp.status), tier: one(sp.tier) };
  const [rows, tiers] = await Promise.all([listSubscriptions(filters), listTiers()]);
  const names = [...new Set([...tiers.map((t) => t.name), ...rows.map((r) => r.name)])];
  const today = pragueToday();
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Všechna předplatné <span className="font-normal text-muted-foreground">({rows.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
          <Input name="q" placeholder="Klient, doména nebo balíček" defaultValue={filters.q} />
          <NativeSelect name="status" defaultValue={filters.status ?? ""}>
            <option value="">Všechny stavy</option>
            {Object.entries(SUBSCRIPTION_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect name="tier" defaultValue={filters.tier ?? ""}>
            <option value="">Všechny balíčky</option>
            {names.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </NativeSelect>
          <Button type="submit" variant="secondary">
            Filtrovat
          </Button>
        </form>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Klient / web</TableHead>
              <TableHead>Balíček</TableHead>
              <TableHead className="text-right">Cena</TableHead>
              <TableHead>Stav</TableHead>
              <TableHead>Zaplaceno do</TableHead>
              <TableHead>Další platba</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const overdue = r.status === "active" && r.paidUntil < today;
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/subscriptions/${r.id}`} className="font-medium hover:underline">
                      {r.clientName}
                    </Link>
                    <div className="text-xs text-muted-foreground">{r.domain ?? r.websiteName}</div>
                  </TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCzk(r.priceHalere)}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "active" ? "secondary" : "outline"}>
                      {SUBSCRIPTION_STATUS_LABELS[r.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className={cn("tabular-nums", overdue && "font-medium text-destructive")}>
                    {formatDate(r.paidUntil)}
                    {overdue ? " · po splatnosti" : ""}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {r.status === "cancelled" ? "–" : formatDate(addDays(r.paidUntil, 1))}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
