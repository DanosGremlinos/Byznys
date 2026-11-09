import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createJob, runJob, runPendingJobs } from "@/server/jobs";

export const maxDuration = 300;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(header);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

/** Daily Vercel Cron (Hobby plan): overdue check (reminders into the approval queue) + resumes unfinished jobs. */
export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const job = await createJob("dunning_run", { trigger: "cron" }, "Denní kontrola plateb");
  await runJob(job.id);
  await runPendingJobs();
  return NextResponse.json({ ok: true });
}
