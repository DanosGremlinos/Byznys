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
import { leadFilterOptions, listLeads, recentJobs, type LeadFilters } from "@/server/leads/queries";
import { goToBuilderFromLead, rescoreAll } from "./actions";
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

async function Jobs() {
  const jobs = await recentJobs();
  return <JobsPanel initial={JSON.parse(JSON.stringify(jobs)) as JobView[]} />;
}

function one(v: string | string[] | undefined) {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

async function LeadsTable({ searchParams }: Pick<PageProps<"/leads">, "searchParams">) {
  const sp = await searchParams;
  const filters: LeadFilters = {
    q: one(sp.q),
    city: one(sp.city),
    category: one(sp.category),
    status: one(sp.status),
    minScore: Number(one(sp.minScore)) || undefined,
  };
  const [rows, options] = await Promise.all([listLeads(filters), leadFilterOptions()]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Leady <span className="font-normal text-muted-foreground">({rows.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]">
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
                    <form action={goToBuilderFromLead.bind(null, lead.id)}>
                      <Button type="submit" size="sm">
                        <Hammer />
                        Postavit web
                      </Button>
                    </form>
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
