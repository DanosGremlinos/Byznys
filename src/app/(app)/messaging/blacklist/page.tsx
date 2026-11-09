import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { listBlacklist } from "@/server/messaging/queries";
import { AddBlacklistForm } from "./add-form";

export const metadata: Metadata = { title: "Blacklist" };

const REASONS: Record<string, string> = {
  unsubscribed: "Odhlášení",
  bounced: "Nedoručitelné",
  complained: "Stížnost / spam",
  manual: "Ručně",
};

export default function BlacklistPage() {
  return (
    <>
      <PageHeader
        title="Blacklist"
        description="Na tyto adresy aplikace nikdy nic neodešle. Odhlášení přes odkaz v e-mailu se sem zapisuje automaticky."
      />
      <Card>
        <CardHeader>
          <CardTitle>Přidat adresu</CardTitle>
        </CardHeader>
        <CardContent>
          <AddBlacklistForm />
        </CardContent>
      </Card>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <List />
      </Suspense>
    </>
  );
}

async function List() {
  const rows = await listBlacklist();
  return (
    <Card>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>E-mail</TableHead>
              <TableHead>Důvod</TableHead>
              <TableHead>Poznámka</TableHead>
              <TableHead>Přidáno</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Blacklist je prázdný.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.email}</TableCell>
                  <TableCell>{REASONS[r.reason]}</TableCell>
                  <TableCell className="text-muted-foreground">{r.note ?? "–"}</TableCell>
                  <TableCell>{formatDateTime(r.createdAt)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
