import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runPendingJobs } from "@/server/jobs";

export const maxDuration = 300;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(header);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

/** Daily Vercel Cron (Hobby plan): resumes unfinished background jobs. Phase 3 adds dunning here. */
export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await runPendingJobs();
  return NextResponse.json({ ok: true });
}
