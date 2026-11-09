import "server-only";
import { and, eq, lt, or, sql } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import type { JobProgress } from "@/db/schema/types";

export type Job = typeof jobs.$inferSelect;
export type JobType = Job["type"];

/** Work budget per invocation; the lease is a bit longer so a crashed run frees the job. */
const WORK_BUDGET_MS = 240_000;
const LEASE_MS = 290_000;
export const MAX_ATTEMPTS = 3;

export type JobContext = {
  job: Job;
  /** True when the invocation should save state and yield. */
  timeUp: () => boolean;
  /** Persist intermediate state and progress (call after each unit of work). */
  save: (result: Record<string, unknown>, progress: JobProgress) => Promise<void>;
};

/** A handler returns true when the job is finished, false to continue in a later invocation. */
export type JobHandler = (ctx: JobContext) => Promise<boolean>;

const handlers = new Map<JobType, JobHandler>();
export function registerJobHandler(type: JobType, handler: JobHandler) {
  handlers.set(type, handler);
}

export async function createJob(type: JobType, params: Record<string, unknown>, message = "Ve frontě") {
  const [job] = await db
    .insert(jobs)
    .values({ type, params, progress: { done: 0, total: 0, message } })
    .returning();
  return job;
}

/** Schedules work on the job after the current response has been sent. */
export function kickJob(jobId: string) {
  after(() => runJob(jobId));
}

/** True when nobody is working on an unfinished job (so a status poll should restart it). */
export function needsKick(job: Pick<Job, "status" | "lockedUntil">, now = new Date()): boolean {
  if (job.status === "queued") return true;
  return job.status === "running" && (!job.lockedUntil || job.lockedUntil < now);
}

async function claim(jobId: string): Promise<Job | null> {
  const now = new Date();
  const [job] = await db
    .update(jobs)
    .set({
      status: "running",
      lockedUntil: new Date(now.getTime() + LEASE_MS),
      startedAt: sql`coalesce(${jobs.startedAt}, now())`,
    })
    .where(
      and(
        eq(jobs.id, jobId),
        or(
          eq(jobs.status, "queued"),
          and(eq(jobs.status, "running"), or(sql`${jobs.lockedUntil} is null`, lt(jobs.lockedUntil, now))),
        ),
      ),
    )
    .returning();
  return job ?? null;
}

export async function runJob(jobId: string): Promise<void> {
  const job = await claim(jobId);
  if (!job) return; // finished, failed, or another invocation holds the lease
  const handler = handlers.get(job.type);
  if (!handler) {
    await db
      .update(jobs)
      .set({ status: "failed", error: `Neznámý typ úlohy: ${job.type}`, finishedAt: new Date() })
      .where(eq(jobs.id, jobId));
    return;
  }
  const started = Date.now();
  let current = job;
  const ctx: JobContext = {
    get job() {
      return current;
    },
    timeUp: () => Date.now() - started > WORK_BUDGET_MS,
    save: async (result, progress) => {
      const [row] = await db.update(jobs).set({ result, progress }).where(eq(jobs.id, jobId)).returning();
      if (row) current = row;
    },
  };
  try {
    const done = await handler(ctx);
    await db
      .update(jobs)
      .set(
        done
          ? { status: "succeeded", finishedAt: new Date(), lockedUntil: null, attempts: 0, error: null }
          : { lockedUntil: null, attempts: 0 }, // stays "running" with a free lease → next poll continues it
      )
      .where(eq(jobs.id, jobId));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const attempts = current.attempts + 1;
    const failed = attempts >= MAX_ATTEMPTS;
    await db
      .update(jobs)
      .set({
        attempts,
        error: failed ? `${message} (3× po sobě, úloha zastavena)` : message,
        lockedUntil: null,
        ...(failed ? { status: "failed" as const, finishedAt: new Date() } : {}),
      })
      .where(eq(jobs.id, jobId));
    console.error(`[jobs] ${job.type} ${jobId} attempt ${attempts} failed: ${message}`);
  }
}

/** Continues every unfinished job (used by the daily cron as a safety net). */
export async function runPendingJobs(limit = 5) {
  const pending = await db.query.jobs.findMany({
    where: (j, { inArray }) => inArray(j.status, ["queued", "running"]),
    orderBy: (j, { asc }) => asc(j.createdAt),
    limit,
  });
  for (const job of pending) if (needsKick(job)) await runJob(job.id);
}
