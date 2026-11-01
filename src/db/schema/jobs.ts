import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createdAt } from "./common";
import { jobStatus, jobType } from "./enums";
import type { JobProgress } from "./types";

/** Background jobs (lead search, site analysis, dunning). Processed in chunks, status shown in UI. */
export const jobs = pgTable(
  "jobs",
  {
    id: uuid().primaryKey().defaultRandom(),
    type: jobType().notNull(),
    status: jobStatus().notNull().default("queued"),
    params: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    progress: jsonb().$type<JobProgress>(),
    result: jsonb().$type<Record<string, unknown>>(),
    error: text(),
    /** Consecutive failed attempts; the job is marked failed after 3. */
    attempts: integer().notNull().default(0),
    /** Lease: a worker holds the job until this time. */
    lockedUntil: timestamp({ withTimezone: true }),
    runAfter: timestamp({ withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp({ withTimezone: true }),
    finishedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.status, t.runAfter), index().on(t.type, t.createdAt)],
);
