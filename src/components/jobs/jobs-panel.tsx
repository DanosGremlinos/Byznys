"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Progress } from "@/components/ui/progress";

type JobView = {
  id: string;
  type: "lead_search" | "site_analysis" | "dunning_run";
  status: "queued" | "running" | "succeeded" | "failed";
  params: { category?: string; city?: string; leadIds?: string[] };
  progress: { done: number; total: number; message?: string } | null;
  error: string | null;
  createdAt: string;
};

const TITLES: Record<JobView["type"], string> = {
  lead_search: "Vyhledávání leadů",
  site_analysis: "Analýza webu",
  dunning_run: "Upomínky",
};

/** Polls background jobs; refreshes the page data when a job finishes. */
export function JobsPanel({ initial }: { initial: JobView[] }) {
  const router = useRouter();
  const [jobs, setJobs] = useState(initial);
  const statuses = useRef(new Map(initial.map((j) => [j.id, j.status])));
  const active = jobs.some((j) => j.status === "queued" || j.status === "running");

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/jobs", { cache: "no-store" });
        if (!res.ok || stop) return;
        const next = (await res.json()) as JobView[];
        let finished = false;
        for (const j of next) {
          const prev = statuses.current.get(j.id);
          if (prev && prev !== j.status && (j.status === "succeeded" || j.status === "failed"))
            finished = true;
          statuses.current.set(j.id, j.status);
        }
        setJobs(next);
        if (finished) router.refresh();
      } catch {
        // network hiccup: try again on the next tick
      }
    };
    const id = setInterval(tick, active ? 3000 : 20000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [active, router]);

  // New jobs started from a server action arrive via props after refresh().
  useEffect(() => {
    setJobs((cur) => {
      const known = new Set(cur.map((j) => j.id));
      const added = initial.filter((j) => !known.has(j.id));
      for (const j of added) statuses.current.set(j.id, j.status);
      return added.length ? [...added, ...cur] : cur;
    });
  }, [initial]);

  if (!jobs.length) return null;
  return (
    <div className="grid gap-2">
      {jobs.slice(0, 4).map((j) => {
        const pct = j.progress?.total ? Math.round((j.progress.done / j.progress.total) * 100) : 0;
        const title =
          j.type === "lead_search" && j.params.category
            ? `${TITLES[j.type]}: ${j.params.category}, ${j.params.city}`
            : TITLES[j.type];
        return (
          <div key={j.id} className="grid gap-1.5 rounded-md border px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 font-medium">
                {j.status === "succeeded" ? (
                  <CheckCircle2 className="size-4 text-emerald-600" />
                ) : j.status === "failed" ? (
                  <XCircle className="size-4 text-destructive" />
                ) : (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                )}
                {title}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(j.createdAt).toLocaleString("cs-CZ", {
                  timeZone: "Europe/Prague",
                  day: "numeric",
                  month: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            {j.status === "running" || j.status === "queued" ? <Progress value={pct} /> : null}
            <p
              className={j.status === "failed" ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
            >
              {j.status === "failed"
                ? j.error
                : j.error && j.status !== "succeeded"
                  ? `Opakuji po chybě: ${j.error}`
                  : j.progress?.message}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export type { JobView };
