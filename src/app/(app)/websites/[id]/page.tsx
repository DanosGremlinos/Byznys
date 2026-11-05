import { ArrowLeft, Calculator, Check, Circle, ExternalLink, FileText, Hammer, Mail, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PackageOffersTable } from "@/components/billing/package-offers-table";
import { EMAIL_STATUS_LABELS, KIND_LABELS } from "@/components/messaging/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/db";
import { requireAdmin } from "@/lib/auth-guard";
import { addDays } from "@/lib/dates";
import { formatCzk, formatDate, formatDateTime } from "@/lib/format";
import { JOB_STAGE_TONE } from "@/lib/job-stage";
import {
  EVENT_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
  WEBSITE_STATUS_LABELS,
} from "@/lib/status-labels";
import { cn } from "@/lib/utils";
import { getJobDetail } from "@/server/websites/queries";
import { openWebsiteInBuilder } from "../../builder/actions";

export const metadata: Metadata = { title: "Zakázka" };

export default function JobPage({ params }: PageProps<"/websites/[id]">) {
  return (
    <>
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="size-4" />
        Přehled
      </Link>
      <Suspense fallback={<Skeleton className="h-[800px] w-full" />}>
        <Job params={params} />
      </Suspense>
    </>
  );
}

async function Job({ params }: Pick<PageProps<"/websites/[id]">, "params">) {
  await requireAdmin();
  const { id } = await params;
  const job = await getJobDetail(db, id);
  if (!job) notFound();
  const { website, client, subscription: sub, threads, offers, stage } = job;
  const url = website.liveUrl ?? website.previewUrl;
  const allEmails = threads
    .flatMap((t) => t.emails.map((e) => ({ ...e, threadId: t.id })))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const sentKinds = new Set(
    allEmails.filter((e) => e.direction === "outbound" && e.status === "sent").map((e) => e.kind),
  );
  const steps: { label: string; done: boolean }[] = [
    { label: "Návrh v Builderu", done: website.builderProjects.length > 0 },
    { label: "L1 – první nabídka odeslána", done: sentKinds.has("offer_l1") },
    { label: "L2 – návrh a smlouva odeslány", done: sentKinds.has("offer_l2") },
    { label: "Dotaz na rozpočet odeslán", done: sentKinds.has("offer_budget") },
    { label: "Balíčky spočítány", done: offers.length > 0 },
    { label: "L3 – balíčky nabídnuty", done: sentKinds.has("offer_l3") },
    { label: "Předplatné založeno", done: !!sub },
  ];

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{website.name}</h1>
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", JOB_STAGE_TONE[stage.key])}>
              {stage.label}
            </span>
            <Badge variant="outline">{WEBSITE_STATUS_LABELS[website.status]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {client.businessName} · {website.domain ?? "bez domény"} · zakázka od {formatDate(website.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {url ? (
            <Button asChild size="sm" variant="outline">
              <a href={url} target="_blank" rel="noreferrer">
                <ExternalLink />
                Otevřít web
              </a>
            </Button>
          ) : null}
          <form action={openWebsiteInBuilder.bind(null, website.id)}>
            <Button type="submit" size="sm" variant="outline">
              <Hammer />
              Builder
            </Button>
          </form>
          <Button asChild size="sm" variant="outline">
            <Link href={`/messaging/queue/new?client=${client.id}`}>
              <Mail />
              Poslat e-mail
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader>
            <CardTitle>Balíček</CardTitle>
          </CardHeader>
          <CardContent>
            {sub ? (
              <div className="grid gap-3 text-sm">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="text-lg font-semibold">{sub.name}</span>
                  <span className="tabular-nums">{formatCzk(sub.priceHalere)} / měsíc</span>
                  <Badge variant={sub.status === "active" ? "secondary" : "outline"}>
                    {SUBSCRIPTION_STATUS_LABELS[sub.status]}
                  </Badge>
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                  <dt className="text-muted-foreground">Od</dt>
                  <dd>{formatDate(sub.startedOn)}</dd>
                  <dt className="text-muted-foreground">Zaplaceno do</dt>
                  <dd>{formatDate(sub.paidUntil)}</dd>
                  {sub.status !== "cancelled" ? (
                    <>
                      <dt className="text-muted-foreground">Další platba</dt>
                      <dd className={cn(stage.key === "overdue" && "font-medium text-destructive")}>
                        {formatDate(addDays(sub.paidUntil, 1))}
                        {stage.key === "overdue" ? " · po splatnosti" : ""}
                      </dd>
                    </>
                  ) : null}
                </dl>
                {sub.features.length ? (
                  <ul className="grid list-disc gap-0.5 pl-5">
                    {sub.features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                ) : null}
                <div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/subscriptions/${sub.id}`}>Spravovat předplatné</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 text-sm">
                <p className="text-muted-foreground">
                  Zakázka zatím nemá balíček. Postup: pošlete „Dotaz na rozpočet“, z odpovědi spočítejte balíčky,
                  pošlete je v e-mailu L3 a po souhlasu klienta založte předplatné.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/settings/tiers?client=${client.id}&website=${website.id}`}>
                      <Calculator />
                      Spočítat balíčky
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant={offers.length ? "default" : "outline"}>
                    <Link href={`/subscriptions/new?client=${client.id}&website=${website.id}`}>
                      <Plus />
                      Založit předplatné
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Postup zakázky</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-1.5 text-sm">
              {steps.map((s) => (
                <li key={s.label} className={cn("flex items-center gap-2", !s.done && "text-muted-foreground")}>
                  {s.done ? (
                    <Check className="size-4 text-emerald-600" />
                  ) : (
                    <Circle className="size-4" />
                  )}
                  {s.label}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Klient</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Firma</dt>
              <dd>{client.businessName}</dd>
              {client.contactPerson ? (
                <>
                  <dt className="text-muted-foreground">Kontakt</dt>
                  <dd>{client.contactPerson}</dd>
                </>
              ) : null}
              {client.email ? (
                <>
                  <dt className="text-muted-foreground">E-mail</dt>
                  <dd className="break-all">{client.email}</dd>
                </>
              ) : null}
              {client.phone ? (
                <>
                  <dt className="text-muted-foreground">Telefon</dt>
                  <dd>{client.phone}</dd>
                </>
              ) : null}
              {client.address ? (
                <>
                  <dt className="text-muted-foreground">Adresa</dt>
                  <dd>{client.address}</dd>
                </>
              ) : null}
              {client.ico ? (
                <>
                  <dt className="text-muted-foreground">IČO</dt>
                  <dd>{client.ico}</dd>
                </>
              ) : null}
              {client.lead ? (
                <>
                  <dt className="text-muted-foreground">Lead</dt>
                  <dd>
                    <Link href={`/leads/${client.lead.id}`} className="underline">
                      {client.lead.name}
                    </Link>
                    {client.lead.score !== null ? ` · skóre ${client.lead.score}` : ""}
                  </dd>
                </>
              ) : null}
            </dl>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Builder</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {website.builderProjects.length ? (
              website.builderProjects.map((p) => (
                <Link key={p.id} href={`/builder/${p.id}`} className="underline">
                  {p.name}
                  {p.promptVersions[0] ? ` · prompt v${p.promptVersions[0].version}` : " · bez promptu"}
                </Link>
              ))
            ) : (
              <p className="text-muted-foreground">Zatím žádný projekt.</p>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Smlouvy</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {job.contracts.length ? (
              job.contracts.map((c) => (
                <a
                  key={c.id}
                  href={`/api/contracts/${c.id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 underline"
                >
                  <FileText className="size-4" />
                  {c.title} ({formatDate(c.createdAt)})
                </a>
              ))
            ) : (
              <p className="text-muted-foreground">Zatím žádná smlouva (vzniká s e-mailem L2).</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Balíčky z kalkulačky</CardTitle>
        </CardHeader>
        <CardContent>
          <PackageOffersTable offers={offers} showClient={false} />
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>E-maily ({allEmails.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {allEmails.length ? (
            <ul className="grid gap-1 text-sm">
              {allEmails.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-b py-1.5 last:border-0">
                  <span className="w-32 shrink-0 text-xs text-muted-foreground tabular-nums">
                    {formatDateTime(e.sentAt ?? e.receivedAt ?? e.createdAt)}
                  </span>
                  <Badge variant="outline">
                    {e.direction === "inbound" ? "Přijatý" : (KIND_LABELS[e.kind ?? "custom"] ?? "E-mail")}
                  </Badge>
                  <Link
                    href={
                      e.direction === "inbound" || e.status === "sent"
                        ? `/messaging/inbox?thread=${e.threadId}`
                        : `/messaging/queue?email=${e.id}`
                    }
                    className="min-w-0 flex-1 truncate underline"
                  >
                    {e.subject}
                  </Link>
                  <span className="text-xs text-muted-foreground">{EMAIL_STATUS_LABELS[e.status]}</span>
                  {e.direction === "inbound" && !e.readAt ? <Badge>nepřečteno</Badge> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Zatím žádná komunikace.</p>
          )}
        </CardContent>
      </Card>

      {sub?.events.length ? (
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Historie předplatného</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1 text-sm">
              {sub.events.map((ev) => (
                <li key={ev.id} className="flex flex-wrap gap-x-3">
                  <span className="w-24 text-xs text-muted-foreground tabular-nums">{formatDate(ev.occurredAt)}</span>
                  <span className="font-medium">{EVENT_LABELS[ev.type] ?? ev.type}</span>
                  {ev.amountHalere !== null ? <span className="tabular-nums">{formatCzk(ev.amountHalere)}</span> : null}
                  {ev.note ? <span className="text-muted-foreground">{ev.note}</span> : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
