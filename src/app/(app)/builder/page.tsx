import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { listProjects } from "@/server/builder/projects";
import { newBlankProject } from "./actions";

export const metadata: Metadata = { title: "Builder" };

export default function BuilderPage() {
  return (
    <>
      <PageHeader
        title="Builder"
        description="Z podkladů klienta sestaví prompt pro Claude Code. Projekt lze otevřít z leadu, z webu na přehledu, nebo začít prázdný."
        actions={
          <form action={newBlankProject}>
            <Button type="submit">
              <Plus />
              Nový prázdný projekt
            </Button>
          </form>
        }
      />
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Projects />
      </Suspense>
    </>
  );
}

async function Projects() {
  const projects = await listProjects();
  return (
    <Card>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Projekt</TableHead>
              <TableHead>Poslední prompt</TableHead>
              <TableHead>Upraveno</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                  Zatím žádné projekty. Začněte z leadu tlačítkem „Postavit web“.
                </TableCell>
              </TableRow>
            ) : (
              projects.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link href={`/builder/${p.id}`} className="font-medium hover:underline">
                      {p.name}
                    </Link>
                  </TableCell>
                  <TableCell>{p.promptVersions[0] ? `verze ${p.promptVersions[0].version}` : "–"}</TableCell>
                  <TableCell>{formatDateTime(p.updatedAt)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
