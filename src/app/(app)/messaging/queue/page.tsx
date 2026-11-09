import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EMAIL_STATUS_LABELS, KIND_LABELS } from "@/components/messaging/labels";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getQueueEmail, listQueue } from "@/server/messaging/queries";
import { QueueEditor } from "./editor";

export const metadata: Metadata = { title: "Ke schválení" };
// Sending (incl. PDF rendering) happens in the server action of this page.
export const maxDuration = 60;

export default function QueuePage({ searchParams }: PageProps<"/messaging/queue">) {
  return (
    <>
      <PageHeader
        title="Ke schválení"
        description="Každý odchozí e-mail čeká tady. Nic se neodešle bez vašeho kliknutí na „Schválit a odeslat“."
        actions={
          <Button asChild>
            <Link href="/messaging/queue/new">
              <Plus />
              Nová nabídka
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Queue searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Queue({ searchParams }: Pick<PageProps<"/messaging/queue">, "searchParams">) {
  const sp = await searchParams;
  const selectedId = typeof sp.email === "string" ? sp.email : undefined;
  const note = typeof sp.note === "string" ? sp.note : undefined;
  const [items, selected] = await Promise.all([listQueue(), selectedId ? getQueueEmail(selectedId) : null]);
  const pending = items.filter((i) => i.status === "pending_approval").length;

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>
            Fronta <span className="font-normal text-muted-foreground">({pending} čeká)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-1 p-2">
          {items.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Fronta je prázdná.</p>
          ) : null}
          {items.map((i) => (
            <Link
              key={i.id}
              href={`/messaging/queue?email=${i.id}`}
              className={cn(
                "grid gap-0.5 rounded-md p-2 text-sm hover:bg-accent",
                selectedId === i.id && "bg-accent",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{i.contact ?? i.toAddress}</span>
                <Badge variant={i.status === "pending_approval" ? "default" : "outline"} className="shrink-0">
                  {i.status === "pending_approval"
                    ? i.kind
                      ? KIND_LABELS[i.kind]
                      : "E-mail"
                    : EMAIL_STATUS_LABELS[i.status]}
                </Badge>
              </div>
              <span className="truncate text-muted-foreground">{i.subject}</span>
              <span className="text-xs text-muted-foreground">
                {formatDateTime(i.createdAt)}
                {i.blacklisted ? " · blacklist" : ""}
              </span>
            </Link>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          {note ? <p className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800">{note}</p> : null}
          {!selected ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Vyberte e-mail ze seznamu.</p>
          ) : selected.direction !== "outbound" ||
            !["pending_approval", "approved", "failed", "blocked"].includes(selected.status) ? (
            <div className="grid gap-2 text-sm">
              {selected.status === "sent" ? (
                <p className="font-medium text-emerald-700">
                  ✓ Odesláno {selected.sentAt ? formatDateTime(selected.sentAt) : ""} na {selected.toAddress}
                </p>
              ) : (
                <p>
                  Tento e-mail je ve stavu <strong>{EMAIL_STATUS_LABELS[selected.status]}</strong> a nelze ho
                  upravit.
                </p>
              )}
              {selected.error ? <p className="text-muted-foreground">{selected.error}</p> : null}
              <p className="font-medium">{selected.subject}</p>
              <Link href={`/messaging/inbox?thread=${selected.threadId}`} className="underline">
                Otevřít konverzaci
              </Link>
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">{selected.kind ? KIND_LABELS[selected.kind] : "E-mail"}</Badge>
                <span>{EMAIL_STATUS_LABELS[selected.status]}</span>
                <span>·</span>
                <span>
                  {selected.thread.client ? `Klient ${selected.thread.client.businessName}` : null}
                  {selected.thread.lead && !selected.thread.client
                    ? `Lead ${selected.thread.lead.name}`
                    : null}
                </span>
                <span>·</span>
                <Link href={`/messaging/inbox?thread=${selected.threadId}`} className="underline">
                  konverzace
                </Link>
              </div>
              <QueueEditor
                key={selected.id + selected.status}
                email={{
                  id: selected.id,
                  toAddress: selected.toAddress,
                  subject: selected.subject,
                  bodyText: selected.bodyText,
                  status: selected.status,
                  error: selected.error,
                  kind: selected.kind,
                }}
                blacklisted={selected.blacklisted}
                attachments={selected.attachments.map((a) => ({
                  id: a.id,
                  url: a.url,
                  filename: a.filename,
                  contentType: a.contentType,
                }))}
                contract={await contractFor(selected.attachments.map((a) => a.url))}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

async function contractFor(urls: string[]) {
  const id = urls.map((u) => u.match(/^\/api\/contracts\/([0-9a-f-]{36})\/pdf$/)?.[1]).find(Boolean);
  if (!id) return null;
  const { db } = await import("@/db");
  const c = await db.query.contracts.findFirst({ where: (t, { eq }) => eq(t.id, id) });
  return c ? { id: c.id, body: c.body } : null;
}
