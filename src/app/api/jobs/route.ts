import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { kickJob, needsKick } from "@/server/jobs";
import { recentJobs } from "@/server/leads/queries";

// Kicked jobs run in `after()` within this route's time limit.
export const maxDuration = 300;

/** Recent background jobs for the status panel. Unfinished jobs nobody works on are resumed. */
export async function GET() {
  await requireAdmin();
  const jobs = await recentJobs();
  for (const job of jobs) if (needsKick(job)) kickJob(job.id);
  return NextResponse.json(
    jobs.map((j) => ({
      id: j.id,
      type: j.type,
      status: j.status,
      params: j.params,
      progress: j.progress,
      error: j.error,
      createdAt: j.createdAt,
      finishedAt: j.finishedAt,
    })),
  );
}
