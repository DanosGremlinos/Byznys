import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getProjectForEditor } from "@/server/builder/projects";
import { BuilderEditor, type EditorProject } from "./editor";

export const metadata: Metadata = { title: "Builder" };

export default function BuilderProjectPage({ params }: PageProps<"/builder/[id]">) {
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
        <Project params={params} />
      </Suspense>
    </>
  );
}

async function Project({ params }: Pick<PageProps<"/builder/[id]">, "params">) {
  const { id } = await params;
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
      </div>
      <BuilderEditor project={editorProject} blobEnabled={Boolean(process.env.BLOB_READ_WRITE_TOKEN)} />
    </>
  );
}
