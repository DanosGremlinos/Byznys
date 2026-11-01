"use client";

import { ExternalLink, Hammer, Mail } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { formatCzk, formatDate } from "@/lib/format";
import { WEBSITE_STATUS_LABELS } from "@/lib/status-labels";
import { cn } from "@/lib/utils";
import type { WebsiteTile } from "@/server/dashboard";

export function WebsiteTiles({
  tiles,
  today,
  openInBuilder,
}: {
  tiles: WebsiteTile[];
  today: string;
  openInBuilder: (websiteId: string) => Promise<void>;
}) {
  const [q, setQ] = useState("");
  const [tier, setTier] = useState("");
  const [status, setStatus] = useState("");
  const tiers = useMemo(
    () =>
      [
        ...new Set(tiles.map((t) => t.subscription?.tierName ?? t.subscription?.name).filter(Boolean)),
      ] as string[],
    [tiles],
  );
  const shown = tiles.filter((t) => {
    const needle = q.trim().toLowerCase();
    if (needle && ![t.name, t.domain, t.clientName].some((v) => v?.toLowerCase().includes(needle)))
      return false;
    if (tier && (t.subscription?.tierName ?? t.subscription?.name) !== tier) return false;
    if (status && t.status !== status) return false;
    return true;
  });

  return (
    <div className="grid gap-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <Input
          placeholder="Hledat web, doménu nebo klienta"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Hledat"
        />
        <NativeSelect value={tier} onChange={(e) => setTier(e.target.value)} aria-label="Tarif">
          <option value="">Všechny tarify</option>
          {tiers.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </NativeSelect>
        <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Stav">
          <option value="">Všechny stavy</option>
          {Object.entries(WEBSITE_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </NativeSelect>
      </div>
      {shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Žádný web neodpovídá filtru.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((t) => {
            const url = t.liveUrl ?? t.previewUrl;
            const overdue = t.subscription?.status === "active" && t.subscription.paidUntil < today;
            return (
              <div key={t.id} className="grid gap-3 rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{t.name}</h3>
                    <p className="truncate text-sm text-muted-foreground">{t.domain ?? "bez domény"}</p>
                    <p className="truncate text-xs text-muted-foreground">{t.clientName}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant={t.status === "live" ? "secondary" : "outline"}>
                      {WEBSITE_STATUS_LABELS[t.status]}
                    </Badge>
                    {t.unreadCount > 0 && t.unreadThreadId ? (
                      <Link
                        href={`/messaging/inbox?thread=${t.unreadThreadId}`}
                        className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground"
                        title="Nepřečtené e-maily"
                      >
                        <Mail className="size-3" />
                        {t.unreadCount}
                      </Link>
                    ) : null}
                  </div>
                </div>
                <div className="rounded-md bg-muted/60 p-2 text-sm">
                  {t.subscription ? (
                    <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                      <dt className="text-muted-foreground">Tarif</dt>
                      <dd className="text-right">{t.subscription.name}</dd>
                      <dt className="text-muted-foreground">Cena</dt>
                      <dd className="text-right tabular-nums">
                        {formatCzk(t.subscription.priceHalere)} / měs.
                      </dd>
                      <dt className="text-muted-foreground">
                        {t.subscription.status === "cancelled" ? "Zaplaceno do" : "Další platba"}
                      </dt>
                      <dd
                        className={cn("text-right tabular-nums", overdue && "font-medium text-destructive")}
                      >
                        {t.subscription.status === "cancelled"
                          ? formatDate(t.subscription.paidUntil)
                          : formatDate(nextDay(t.subscription.paidUntil))}
                        {overdue ? " · po splatnosti" : ""}
                      </dd>
                    </dl>
                  ) : (
                    <p className="text-muted-foreground">Bez předplatného</p>
                  )}
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
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/messaging/queue/new?client=${t.clientId}`}>
                      <Mail />
                      Poslat e-mail
                    </Link>
                  </Button>
                  <form action={openInBuilder.bind(null, t.id)}>
                    <Button type="submit" size="sm" variant="outline">
                      <Hammer />
                      Otevřít v builderu
                    </Button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function nextDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}
