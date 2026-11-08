import { ArrowLeft, Briefcase } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { blobMode } from "@/lib/blob-config";
import { getProjectForEditor } from "@/server/builder/projects";
import { createJobAction } from "../actions";
import { BuilderEditor, type EditorProject } from "./editor";

export const metadata: Metadata = { title: "Builder" };

export default function BuilderProjectPage({ params, searchParams }: PageProps<"/builder/[id]">) {
  return (
    <>
      <Link
        href="/builder"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-4" />
        Všechny projekty
      </Link>
      <Suspense fallback={<Skeleton className="h-[800px] w-full" />}>
        <Project params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Project({
  params,
  searchParams,
}: Pick<PageProps<"/builder/[id]">, "params" | "searchParams">) {
  const { id } = await params;
  const { jobError } = await searchParams;
  const project = await getProjectForEditor(id);
  if (!project) notFound();
  const editorProject: EditorProject = {
    id: project.id,
    name: project.name,
    clientInfo: project.clientInfo,
    structure: project.structure,
    style: project.style,
    customInstructions: project.customInstructions,
    assets: project.assets.map((a) => ({
      id: a.id,
      kind: a.kind,
      source: a.source,
      url: a.url,
      filename: a.filename,
      contentType: a.contentType,
      sortOrder: a.sortOrder,
      isHero: a.isHero,
      isSelected: a.isSelected,
      rightsConfirmed: a.rightsConfirmed,
      attribution: a.leadPhoto?.attribution ?? null,
      review: a.leadReview
        ? { author: a.leadReview.author, rating: a.leadReview.rating, text: a.leadReview.text }
        : null,
    })),
    promptVersions: project.promptVersions.map((v) => ({
      id: v.id,
      version: v.version,
      content: v.content,
      createdAt: v.createdAt.toISOString(),
    })),
  };
  return (
    <>
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
        <p className="text-sm text-muted-foreground">
          {project.lead ? (
            <>
              Z leadu{" "}
              <Link href={`/leads/${project.lead.id}`} className="underline">
                {project.lead.name}
              </Link>
            </>
          ) : null}
          {project.lead && project.website ? " · " : null}
          {project.website ? `Web ${project.website.domain ?? project.website.name}` : null}
          {!project.lead && !project.website ? "Prázdný projekt" : null}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {project.website ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`/websites/${project.website.id}`}>
                <Briefcase />
                Zakázka: {project.website.domain ?? project.website.name}
              </Link>
            </Button>
          ) : (
            <form action={createJobAction.bind(null, project.id)}>
              <Button type="submit" size="sm">
                <Briefcase />
                Založit zakázku
              </Button>
              <span className="ml-2 text-xs text-muted-foreground">
                Vytvoří klienta a web na přehledu{project.lead ? "" : " (nejdřív uložte název firmy)"}.
              </span>
              {typeof jobError === "string" ? (
                <p className="mt-1 text-sm text-destructive">{jobError}</p>
              ) : null}
            </form>
          )}
        </div>
      </div>
      <BuilderEditor project={editorProject} blobMode={blobMode()} />
    </>
  );
}
