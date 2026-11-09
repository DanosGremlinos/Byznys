import { RefreshCw } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DunningStepsView, RUN_STATUS_LABELS } from "@/components/billing/dunning-steps";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCzk, formatDate, formatDateTime } from "@/lib/format";
import { WEBSITE_STATUS_LABELS } from "@/lib/status-labels";
import { lastDunningJobs, listOverdue, type OverdueSort } from "@/server/billing/queries";
import { suspendWebsiteAction } from "../subscriptions/actions";
import { checkOverdueNow, quickPayAction, setRunPausedAction } from "./actions";

export const metadata: Metadata = { title: "Neuhrazené platby" };
// The manual check runs in after() within this page's limit.
export const maxDuration = 120;

export default function OverduePage({ searchParams }: PageProps<"/overdue">) {
  return (
    <>
      <PageHeader
        title="Neuhrazené platby"
        description="Předplatné po splatnosti. Upomínky (den 0 / 3 / 7) se připravují do fronty ke schválení – nic se neodešle samo."
        actions={
          <form action={checkOverdueNow}>
            <Button type="submit" variant="outline">
              <RefreshCw />
              Zkontrolovat teď
            </Button>
          </form>
        }
      />
      <Suspense fallback={null}>
        <LastCheck />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <List searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function LastCheck() {
  const jobs = await lastDunningJobs(1);
  const j = jobs[0];
  if (!j)
    return (
      <p className="text-sm text-muted-foreground">
        Kontrola zatím neproběhla. Denně ji spouští cron, nebo klikněte na „Zkontrolovat teď“.
      </p>
    );
  return (
    <p className="text-sm text-muted-foreground">
      Poslední kontrola: {formatDateTime(j.createdAt)} ·{" "}
      {j.status === "succeeded"
        ? j.progress?.message
        : j.status === "failed"
          ? `chyba: ${j.error}`
          : "probíhá…"}
    </p>
  );
}

const SORTS: { key: OverdueSort; label: string }[] = [
  { key: "days", label: "Dny po splatnosti" },
  { key: "amount", label: "Částka" },
  { key: "client", label: "Klient" },
];

async function List({ searchParams }: Pick<PageProps<"/overdue">, "searchParams">) {
  const sp = await searchParams;
  const sort = (SORTS.find((s) => s.key === sp.sort)?.key ?? "days") as OverdueSort;
  const q = typeof sp.q === "string" && sp.q.trim() ? sp.q.trim() : undefined;
  const minDays = Number(sp.minDays) || undefined;
  const rows = await listOverdue({ sort, q, minDays });
  const total = rows.reduce((s, r) => s + r.priceHalere, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Po splatnosti: {rows.length}{" "}
          <span className="font-normal text-muted-foreground">· celkem {formatCzk(total)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {typeof sp.suspendError === "string" ? (
          <p className="rounded-md bg-amber-50 p-2 text-sm text-amber-800">{sp.suspendError}</p>
        ) : null}
        <form className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
          <Input name="q" placeholder="Klient nebo doména" defaultValue={q} />
          <NativeSelect name="minDays" defaultValue={String(minDays ?? "")}>
            <option value="">Jakákoli doba</option>
            <option value="3">3+ dny</option>
            <option value="7">7+ dní</option>
            <option value="14">14+ dní</option>
          </NativeSelect>
          <NativeSelect name="sort" defaultValue={sort}>
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                Řadit: {s.label}
              </option>
            ))}
          </NativeSelect>
          <Button type="submit" variant="secondary">
            Použít
          </Button>
        </form>

        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nic není po splatnosti.</p>
        ) : (
          <ul className="grid gap-3">
            {rows.map((r) => (
              <li key={r.subscriptionId} className="grid gap-3 rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/subscriptions/${r.subscriptionId}`}
                      className="font-semibold hover:underline"
                    >
                      {r.clientName}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {r.domain ?? r.websiteName} · {r.name} · web: {WEBSITE_STATUS_LABELS[r.websiteStatus]}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold tabular-nums">{formatCzk(r.priceHalere)}</p>
                    <p className="text-sm text-destructive tabular-nums">
                      {r.daysOverdue} {r.daysOverdue === 1 ? "den" : r.daysOverdue < 5 ? "dny" : "dní"} po
                      splatnosti (od {formatDate(r.dueDate)})
                    </p>
                  </div>
                </div>
                {r.run ? (
                  <div className="grid gap-2">
                    <p className="text-sm">
                      <Badge variant={r.run.status === "paused" ? "outline" : "secondary"}>
                        {RUN_STATUS_LABELS[r.run.status]}
                      </Badge>
                    </p>
                    <DunningStepsView steps={r.run.steps} />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Upomínky ještě nezačaly – spustí je nejbližší kontrola.
                  </p>
                )}
                {!r.clientEmail ? (
                  <p className="text-sm text-amber-700">Klient nemá e-mail – upomínky nelze připravit.</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <form action={quickPayAction.bind(null, r.subscriptionId)}>
                    <Button type="submit" size="sm">
                      Zaplaceno (1 měsíc)
                    </Button>
                  </form>
                  {r.run && (r.run.status === "active" || r.run.status === "paused") ? (
                    <form action={setRunPausedAction.bind(null, r.run.id, r.run.status === "active")}>
                      <Button type="submit" size="sm" variant="outline">
                        {r.run.status === "active" ? "Pozastavit upomínky" : "Obnovit upomínky"}
                      </Button>
                    </form>
                  ) : null}
                  <form
                    action={suspendWebsiteAction.bind(
                      null,
                      r.websiteId,
                      r.websiteStatus !== "suspended",
                      "/overdue",
                    )}
                  >
                    <Button type="submit" size="sm" variant="outline">
                      {r.websiteStatus === "suspended" ? "Znovu spustit web" : "Pozastavit web"}
                    </Button>
                  </form>
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/subscriptions/${r.subscriptionId}`}>Detail a jiná platba</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
