import { ExternalLink, Hammer, RefreshCw } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { JobsPanel, type JobView } from "@/components/jobs/jobs-panel";
import { PageHeader } from "@/components/layout/page-header";
import { FiredFactors, ScoreBadge } from "@/components/leads/score";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LEAD_STATUS_LABELS } from "@/lib/status-labels";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  leadFilterOptions,
  listLeads,
  listSearchGroups,
  recentJobs,
  type LeadFilters,
} from "@/server/leads/queries";
import { goToBuilderFromLead, rescoreAll } from "./actions";
import { DeleteLeadButton } from "./delete-lead";
import { LeadSearchForm } from "./search-form";

export const metadata: Metadata = { title: "Leady" };
// Server actions on this page start background jobs that run in after().
export const maxDuration = 300;

export default function LeadsPage({ searchParams }: PageProps<"/leads">) {
  return (
    <>
      <PageHeader
        title="Leady"
        description="Vyhledávání podniků přes Google Places, analýza jejich webu a skóre příležitosti."
        actions={
          <form action={rescoreAll}>
            <Button type="submit" variant="outline" size="sm">
              <RefreshCw />
              Přepočítat skóre
            </Button>
          </form>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Nové vyhledávání</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <LeadSearchForm />
          <Suspense fallback={null}>
            <SearchQuota />
          </Suspense>
          <Suspense fallback={null}>
            <Jobs />
          </Suspense>
        </CardContent>
      </Card>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <LeadsTable searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function SearchQuota() {
  const [{ db }, { leadSearchQuota }] = await Promise.all([import("@/db"), import("@/server/leads/quota")]);
  const { used, limit, remaining } = await leadSearchQuota(db);
  return (
    <p className={remaining === 0 ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
      Dnes použito {used} z {limit} vyhledávání
      {remaining === 0 ? " – limit je vyčerpaný, další půjde zítra." : ` (zbývá ${remaining}).`}
    </p>
  );
}

async function Jobs() {
  const jobs = await recentJobs();
  return <JobsPanel initial={JSON.parse(JSON.stringify(jobs)) as JobView[]} />;
}

function one(v: string | string[] | undefined) {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

async function LeadsTable({ searchParams }: Pick<PageProps<"/leads">, "searchParams">) {
  const sp = await searchParams;
  const searches = await listSearchGroups();
  // Default: the newest search, so new results aren't mixed into older ones. "all" shows every lead.
  const requested = one(sp.search);
  const search =
    requested === "all" || requested === "none" || searches.groups.some((g) => g.id === requested)
      ? requested
      : (searches.groups[0]?.id ?? "all");
  const filters: LeadFilters = {
    q: one(sp.q),
    city: one(sp.city),
    category: one(sp.category),
    status: one(sp.status),
    minScore: Number(one(sp.minScore)) || undefined,
    search: search === "all" ? undefined : search,
  };
  const [rows, options] = await Promise.all([listLeads(filters), leadFilterOptions()]);
  const current = searches.groups.find((g) => g.id === search);
  const chip = (key: string, label: React.ReactNode, count: number, active: boolean) => (
    <Link
      key={key}
      href={`/leads?search=${key}`}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm whitespace-nowrap",
        active ? "border-foreground bg-foreground text-background" : "hover:bg-accent",
      )}
    >
      {label}
      <span className={cn("tabular-nums", active ? "opacity-80" : "text-muted-foreground")}>{count}</span>
    </Link>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {current ? `${current.category}, ${current.city}` : search === "none" ? "Leady bez hledání" : "Všechny leady"}{" "}
          <span className="font-normal text-muted-foreground">({rows.length})</span>
        </CardTitle>
        {current ? (
          <p className="text-sm text-muted-foreground">Hledání z {formatDateTime(current.createdAt)}</p>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-4">
        <nav aria-label="Hledání" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {searches.groups.map((g) =>
            chip(
              g.id,
              <>
                <span className="font-medium">
                  {g.category}, {g.city}
                </span>
                <span className={search === g.id ? "opacity-80" : "text-muted-foreground"}>
                  {formatDate(g.createdAt)}
                </span>
              </>,
              g.leadCount,
              search === g.id,
            ),
          )}
          {searches.withoutSearch ? chip("none", "Bez hledání", searches.withoutSearch, search === "none") : null}
          {chip("all", "Všechny leady", searches.total, search === "all")}
        </nav>
        <form className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]">
          <input type="hidden" name="search" value={search} />
          <Input name="q" placeholder="Hledat název nebo adresu" defaultValue={filters.q} />
          <NativeSelect name="city" defaultValue={filters.city ?? ""}>
            <option value="">Všechna města</option>
            {options.cities.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </NativeSelect>
          <NativeSelect name="category" defaultValue={filters.category ?? ""}>
            <option value="">Všechny kategorie</option>
            {options.categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </NativeSelect>
          <NativeSelect name="status" defaultValue={filters.status ?? ""}>
            <option value="">Všechny stavy</option>
            {Object.entries(LEAD_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect name="minScore" defaultValue={String(filters.minScore ?? "")}>
            <option value="">Jakékoli skóre</option>
            <option value="40">Skóre 40+</option>
            <option value="70">Skóre 70+</option>
          </NativeSelect>
          <Button type="submit" variant="secondary">
            Filtrovat
          </Button>
        </form>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">Skóre</TableHead>
              <TableHead>Podnik</TableHead>
              <TableHead className="hidden md:table-cell">Hodnocení</TableHead>
              <TableHead>Faktory</TableHead>
              <TableHead className="hidden lg:table-cell">Stav</TableHead>
              <TableHead className="text-right">Akce</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Žádné leady neodpovídají filtru.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>
                    <ScoreBadge score={lead.score} />
                  </TableCell>
                  <TableCell className="max-w-64 whitespace-normal">
                    <Link href={`/leads/${lead.id}`} className="font-medium hover:underline">
                      {lead.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {[lead.category, lead.city].filter(Boolean).join(" · ")}
                    </div>
                    {lead.websiteUrl ? (
                      <a
                        href={lead.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
                      >
                        {lead.websiteUrl.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                        <ExternalLink className="size-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-amber-700">bez webu</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden tabular-nums md:table-cell">
                    {lead.rating ? `${lead.rating.toLocaleString("cs-CZ")} ★` : "–"}
                    <div className="text-xs text-muted-foreground">{lead.reviewCount ?? 0} recenzí</div>
                  </TableCell>
                  <TableCell className="max-w-96 whitespace-normal">
                    <FiredFactors factors={lead.scoreFactors} />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <Badge variant="outline">{LEAD_STATUS_LABELS[lead.status]}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <form action={goToBuilderFromLead.bind(null, lead.id)}>
                        <Button type="submit" size="sm">
                          <Hammer />
                          Postavit web
                        </Button>
                      </form>
                      <DeleteLeadButton leadId={lead.id} name={lead.name} />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
