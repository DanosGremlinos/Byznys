import { ArrowLeft, ExternalLink, Hammer, Mail, MapPin, RefreshCw } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CopyButton } from "@/components/common/copy-button";
import { FactorTable, ScoreBadge } from "@/components/leads/score";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCzk, formatDate, formatDateTime } from "@/lib/format";
import { LEAD_STATUS_LABELS } from "@/lib/status-labels";
import { formatOpeningHours } from "@/server/builder/prompt";
import { getLead } from "@/server/leads/queries";
import { loadResearchTemplate, renderResearchPrompt } from "@/server/leads/research-prompt";
import { SCORING_VERSION } from "@/server/leads/scoring";
import { goToBuilderFromLead, reanalyzeLead } from "../actions";
import { ExplainScore } from "./explain";

export const metadata: Metadata = { title: "Detail leadu" };
export const maxDuration = 300;

export default function LeadDetailPage({ params }: PageProps<"/leads/[id]">) {
  return (
    <>
      <Link
        href="/leads"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-4" />
        Zpět na leady
      </Link>
      <Suspense fallback={<Skeleton className="h-[600px] w-full" />}>
        <LeadDetail params={params} />
      </Suspense>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2 py-1 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children ?? "–"}</dd>
    </div>
  );
}

const yesNo = (v: boolean | null) => (v === null ? "–" : v ? "ano" : "ne");

async function LeadDetail({ params }: Pick<PageProps<"/leads/[id]">, "params">) {
  const { id } = await params;
  const data = await getLead(id);
  if (!data) notFound();
  const { lead, photos, reviews, analysis } = data;
  const researchPrompt = renderResearchPrompt(await loadResearchTemplate(), lead);
  const hours = formatOpeningHours(lead.openingHours);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <ScoreBadge score={lead.score} className="h-12 w-14 text-lg" />
          <div className="grid gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">{lead.name}</h1>
            <p className="text-sm text-muted-foreground">
              {[lead.category, lead.city].filter(Boolean).join(" · ")} ·{" "}
              <Badge variant="outline">{LEAD_STATUS_LABELS[lead.status]}</Badge>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={reanalyzeLead.bind(null, lead.id)}>
            <Button type="submit" variant="outline" size="sm">
              <RefreshCw />
              Znovu analyzovat web
            </Button>
          </form>
          {lead.email ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/messaging/queue/new?lead=${lead.id}`}>
                <Mail />
                Připravit nabídku
              </Link>
            </Button>
          ) : null}
          <form action={goToBuilderFromLead.bind(null, lead.id)}>
            <Button type="submit" size="sm">
              <Hammer />
              Postavit web
            </Button>
          </form>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Kontakt</CardTitle>
          </CardHeader>
          <CardContent>
            <dl>
              <Row label="Adresa">{lead.address}</Row>
              <Row label="Telefon">{lead.phone}</Row>
              <Row label="E-mail">{lead.email}</Row>
              <Row label="Kontaktní osoba">{lead.contactPerson}</Row>
              <Row label="Web">
                {lead.websiteUrl ? (
                  <a
                    href={lead.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 hover:underline"
                  >
                    {lead.websiteUrl}
                    <ExternalLink className="size-3" />
                  </a>
                ) : (
                  "nemá web"
                )}
              </Row>
              <Row label="Google Maps">
                {lead.googleMapsUrl ? (
                  <a
                    href={lead.googleMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 hover:underline"
                  >
                    <MapPin className="size-3" />
                    otevřít
                  </a>
                ) : null}
              </Row>
              <Row label="Hodnocení">
                {lead.rating
                  ? `${lead.rating.toLocaleString("cs-CZ")} ★ (${lead.reviewCount ?? 0} recenzí)`
                  : null}
              </Row>
              <Row label="Sociální sítě">
                {Object.entries(lead.socialLinks ?? {}).length ? (
                  <span className="flex flex-wrap gap-2">
                    {Object.entries(lead.socialLinks ?? {}).map(([k, v]) => (
                      <a key={k} href={v} target="_blank" rel="noreferrer" className="hover:underline">
                        {k}
                      </a>
                    ))}
                  </span>
                ) : null}
              </Row>
              <Row label="Otevírací doba">
                {hours.length ? (
                  <ul>
                    {hours.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                ) : null}
              </Row>
              <Row label="Přidáno">{formatDate(lead.createdAt)}</Row>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Skóre příležitosti: {lead.score ?? "–"}/100</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <FactorTable factors={lead.scoreFactors} />
            <p className="text-xs text-muted-foreground">
              Verze vah: {lead.scoreVersion ?? "–"}
              {lead.scoreVersion && lead.scoreVersion !== SCORING_VERSION
                ? " (zastaralá – přepočítejte skóre)"
                : ""}
              {lead.scoredAt ? ` · spočítáno ${formatDateTime(lead.scoredAt)}` : ""}. Váhy jsou v
              src/config/scoring.ts.
            </p>
            <ExplainScore leadId={lead.id} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Analýza webu</CardTitle>
          </CardHeader>
          <CardContent>
            {!analysis ? (
              <p className="text-sm text-muted-foreground">
                {lead.websiteUrl ? "Web zatím nebyl analyzován." : "Podnik nemá web."}
              </p>
            ) : analysis.error ? (
              <p className="text-sm text-destructive">Web se nepodařilo načíst: {analysis.error}</p>
            ) : (
              <dl>
                <Row label="Analyzováno">{formatDateTime(analysis.fetchedAt)}</Row>
                <Row label="HTTP / HTTPS">
                  {analysis.httpStatus ?? "–"} / {yesNo(analysis.isHttps)}
                </Row>
                <Row label="Copyright">{analysis.copyrightYear}</Row>
                <Row label="Technologie">
                  {[
                    analysis.techSignals?.generator,
                    analysis.techSignals?.jqueryVersion && `jQuery ${analysis.techSignals.jqueryVersion}`,
                    analysis.techSignals?.usesFlash && "Flash",
                    analysis.techSignals?.tableLayout && "tabulkový layout",
                  ]
                    .filter(Boolean)
                    .join(", ") || "–"}
                </Row>
                <Row label="PageSpeed">
                  mobil {analysis.pagespeedMobile ?? "–"} · desktop {analysis.pagespeedDesktop ?? "–"}
                </Row>
                <Row label="Mobilní viewport">{yesNo(analysis.hasViewportMeta)}</Row>
                <Row label="SEO">
                  title {yesNo(analysis.hasTitle)} · description {yesNo(analysis.hasMetaDescription)} · h1{" "}
                  {yesNo(analysis.hasH1)}
                </Row>
                <Row label="Problémy designu">
                  {analysis.designIssues?.length ? (
                    <ul className="list-disc pl-4">
                      {analysis.designIssues.map((i) => (
                        <li key={i}>{i}</li>
                      ))}
                    </ul>
                  ) : (
                    "žádné"
                  )}
                </Row>
              </dl>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Logo, barvy, služby</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <div className="flex items-center gap-4">
              {lead.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={lead.logoUrl}
                  alt={`Logo ${lead.name}`}
                  className="size-16 rounded border object-contain"
                />
              ) : (
                <span className="text-muted-foreground">Logo nenalezeno</span>
              )}
              <div className="flex gap-1">
                {(lead.brandColors ?? []).map((c) => (
                  <span key={c} title={c} className="size-8 rounded border" style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            {lead.services?.length ? (
              <ul className="grid gap-1">
                {lead.services.map((s) => (
                  <li key={s.name} className="flex justify-between gap-4 border-b pb-1 last:border-0">
                    <span>{s.name}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {s.priceHalere !== undefined ? formatCzk(s.priceHalere) : s.priceText}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">Služby / ceník na webu nenalezeny.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fotky ({photos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {photos.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {photos.map((p) => (
                <figure key={p.id} className="grid gap-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt=""
                    loading="lazy"
                    className="aspect-[4/3] w-full rounded-md border object-cover"
                  />
                  {p.attribution ? (
                    <figcaption className="truncate text-xs text-muted-foreground">
                      {p.attribution}
                    </figcaption>
                  ) : null}
                </figure>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Žádné fotky.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nejlepší recenze</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {reviews.length ? (
            reviews.slice(0, 5).map((r) => (
              <blockquote key={r.id} className="border-l-2 pl-3 text-sm">
                <p>„{r.text}“</p>
                <footer className="mt-1 text-xs text-muted-foreground">
                  {r.author} · {"★".repeat(r.rating)}
                  {r.publishedAt ? ` · ${formatDate(r.publishedAt)}` : ""}
                </footer>
              </blockquote>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Žádné recenze.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Prompt pro hloubkový research</CardTitle>
          <div className="flex gap-2">
            <CopyButton text={researchPrompt} />
            <Button asChild variant="outline" size="sm">
              <a
                href={`data:text/markdown;charset=utf-8,${encodeURIComponent(researchPrompt)}`}
                download={`research-${lead.id}.md`}
              >
                Stáhnout .md
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <pre className="max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">
            {researchPrompt}
          </pre>
          <p className="mt-2 text-xs text-muted-foreground">Šablona: /prompts/lead-research.md</p>
        </CardContent>
      </Card>
    </>
  );
}
