import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { CLASSIFICATION_LABELS, EMAIL_STATUS_LABELS, KIND_LABELS } from "@/components/messaging/labels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { messagingStats } from "@/server/messaging/queries";

export const metadata: Metadata = { title: "Statistiky" };

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : "–");
const MONTHS = ["led", "úno", "bře", "dub", "kvě", "čvn", "čvc", "srp", "zář", "říj", "lis", "pro"];

export default function StatsPage() {
  return (
    <>
      <PageHeader title="Statistiky" description="Odeslané e-maily, odpovědi a jejich klasifikace." />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Stats />
      </Suspense>
    </>
  );
}

async function Stats() {
  const s = await messagingStats();
  const totalInbound = s.classes.reduce((a, c) => a + c.n, 0);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Odpovědi podle úrovně</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Typ</TableHead>
                <TableHead className="text-right">Odesláno</TableHead>
                <TableHead className="text-right">S odpovědí</TableHead>
                <TableHead className="text-right">Míra odpovědí</TableHead>
                <TableHead className="text-right">Má zájem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {s.byLevel.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Zatím nic odesláno.
                  </TableCell>
                </TableRow>
              ) : (
                s.byLevel.map((r) => (
                  <TableRow key={r.kind}>
                    <TableCell>{KIND_LABELS[r.kind] ?? r.kind}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.sent}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.replied}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(r.replied, r.sent)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.interested}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Klasifikace odpovědí</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              {s.classes.map((c) => (
                <TableRow key={c.classification ?? "none"}>
                  <TableCell>
                    {c.classification ? CLASSIFICATION_LABELS[c.classification] : "Neklasifikováno"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{c.n}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {pct(c.n, totalInbound)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell>Nepřečtené</TableCell>
                <TableCell className="text-right tabular-nums">{s.unread}</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Odchozí e-maily podle stavu</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              {s.statuses.map((c) => (
                <TableRow key={c.status}>
                  <TableCell>{EMAIL_STATUS_LABELS[c.status]}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.n}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Posledních 6 měsíců</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Měsíc</TableHead>
                <TableHead className="text-right">Odesláno</TableHead>
                <TableHead className="text-right">Přijato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {s.monthly.map((m) => (
                <TableRow key={m.month}>
                  <TableCell>
                    {MONTHS[Number(m.month.slice(5)) - 1]} {m.month.slice(0, 4)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{m.sent}</TableCell>
                  <TableCell className="text-right tabular-nums">{m.received}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
