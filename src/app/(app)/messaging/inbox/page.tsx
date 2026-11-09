import type { Metadata } from "next";
import { Calculator } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import {
  CLASSIFICATION_LABELS,
  CLASSIFICATION_TONE,
  EMAIL_STATUS_LABELS,
  KIND_LABELS,
} from "@/components/messaging/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { aiConfigured } from "@/server/ai/client";
import { isLiveEmailProvider } from "@/server/email/provider";
import { getThread, listThreads, type ThreadFilter } from "@/server/messaging/queries";
import { ClassificationControl, MarkRead, ReplyForm, SimulateInbound } from "./thread-controls";

export const metadata: Metadata = { title: "Doručená pošta" };
export const maxDuration = 120;

const FILTERS: { key: ThreadFilter; label: string }[] = [
  { key: "all", label: "Vše" },
  { key: "unread", label: "Nepřečtené" },
  { key: "interested", label: "Má zájem" },
  { key: "question", label: "Dotaz" },
  { key: "change_request", label: "Změna" },
  { key: "not_interested", label: "Nemá zájem" },
];

export default function InboxPage({ searchParams }: PageProps<"/messaging/inbox">) {
  return (
    <>
      <PageHeader
        title="Doručená pošta"
        description="Odpovědi klientů a leadů. Agent je třídí, vy můžete klasifikaci změnit."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Inbox searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Inbox({ searchParams }: Pick<PageProps<"/messaging/inbox">, "searchParams">) {
  const sp = await searchParams;
  const filter = (FILTERS.find((f) => f.key === sp.filter)?.key ?? "all") as ThreadFilter;
  const threadId = typeof sp.thread === "string" ? sp.thread : undefined;
  const [threads, thread] = await Promise.all([listThreads(filter), threadId ? getThread(threadId) : null]);
  const ai = aiConfigured();
  const devMode = !isLiveEmailProvider();
  const unread = thread ? thread.emails.filter((e) => e.direction === "inbound" && !e.readAt).length : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[24rem_1fr]">
      <Card>
        <CardHeader className="gap-3">
          <CardTitle>Konverzace</CardTitle>
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={`/messaging/inbox?filter=${f.key}${threadId ? `&thread=${threadId}` : ""}`}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs",
                  filter === f.key ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                )}
              >
                {f.label}
              </Link>
            ))}
          </div>
        </CardHeader>
        <CardContent className="grid gap-1 p-2">
          {threads.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Žádné konverzace.</p>
          ) : null}
          {threads.map((t) => (
            <Link
              key={t.id}
              href={`/messaging/inbox?filter=${filter}&thread=${t.id}`}
              className={cn(
                "grid gap-0.5 rounded-md p-2 text-sm hover:bg-accent",
                threadId === t.id && "bg-accent",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={cn("truncate", t.unread > 0 ? "font-semibold" : "font-medium")}>
                  {t.contact ?? "Neznámý odesílatel"}
                </span>
                {t.unread > 0 ? <Badge className="shrink-0">{t.unread}</Badge> : null}
              </div>
              <span className="truncate text-muted-foreground">{t.subject}</span>
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{formatDateTime(t.lastMessageAt)}</span>
                {t.lastClassification ? (
                  <span className={cn("rounded px-1.5 py-0.5", CLASSIFICATION_TONE[t.lastClassification])}>
                    {CLASSIFICATION_LABELS[t.lastClassification]}
                  </span>
                ) : null}
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {!thread ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Vyberte konverzaci.</p>
          ) : (
            <div className="grid gap-5">
              <MarkRead threadId={thread.id} unread={unread} />
              <div>
                <h2 className="text-lg font-semibold">{thread.subject}</h2>
                <p className="text-sm text-muted-foreground">
                  {thread.client ? `Klient: ${thread.client.businessName}` : null}
                  {thread.client && thread.lead ? " · " : null}
                  {thread.lead ? (
                    <>
                      Lead:{" "}
                      <Link href={`/leads/${thread.lead.id}`} className="underline">
                        {thread.lead.name}
                      </Link>
                    </>
                  ) : null}
                </p>
                {thread.client && thread.emails.some((e) => e.kind === "offer_budget") ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/settings/tiers?client=${thread.client.id}`}>
                        <Calculator />
                        Spočítat balíčky z odpovědi
                      </Link>
                    </Button>
                  </div>
                ) : null}
              </div>
              <ol className="grid gap-3">
                {thread.emails.map((e) => (
                  <li
                    key={e.id}
                    className={cn(
                      "grid gap-2 rounded-lg border p-3 text-sm",
                      e.direction === "inbound" ? "mr-8 bg-muted/50" : "ml-8",
                      e.direction === "inbound" && !e.readAt && "border-primary",
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        {e.direction === "inbound" ? `Od: ${e.fromAddress}` : `Komu: ${e.toAddress}`}
                        {e.kind ? ` · ${KIND_LABELS[e.kind]}` : ""}
                        {e.direction === "outbound" ? ` · ${EMAIL_STATUS_LABELS[e.status]}` : ""}
                      </span>
                      <span>{formatDateTime(e.sentAt ?? e.receivedAt ?? e.createdAt)}</span>
                    </div>
                    <p className="font-medium">{e.subject}</p>
                    <p className="whitespace-pre-wrap">{e.bodyText}</p>
                    {e.attachments.length ? (
                      <p className="text-xs">
                        Přílohy:{" "}
                        {e.attachments.map((a) => (
                          <a
                            key={a.id}
                            href={a.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mr-2 underline"
                          >
                            {a.filename}
                          </a>
                        ))}
                      </p>
                    ) : null}
                    {e.direction === "outbound" && e.status === "pending_approval" ? (
                      <Link href={`/messaging/queue?email=${e.id}`} className="text-xs underline">
                        Čeká na schválení – otevřít ve frontě
                      </Link>
                    ) : null}
                    {e.direction === "inbound" ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
                        <ClassificationControl emailId={e.id} value={e.classification} aiEnabled={ai} />
                        <span className="text-xs text-muted-foreground">
                          {e.classificationSource === "ai"
                            ? `AI${e.classificationConfidence ? ` ${Math.round(e.classificationConfidence * 100)} %` : ""}${e.classificationReason ? ` – ${e.classificationReason}` : ""}`
                            : e.classificationSource === "manual"
                              ? "Ručně"
                              : ""}
                        </span>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ol>
              <ReplyForm threadId={thread.id} aiEnabled={ai} />
              {devMode ? <SimulateInbound threadId={thread.id} /> : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
