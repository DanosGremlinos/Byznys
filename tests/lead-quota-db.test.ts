// Integration: daily lead-search limit. Requires TEST_DATABASE_URL; skipped otherwise.
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/db/client";
import { jobs } from "@/db/schema";
import { leadSearchQuota, reserveLeadSearch } from "@/server/leads/quota";
import { setupTestDb } from "./helpers/db";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("lead search daily limit (DB)", () => {
  let db: Database;
  const prev = process.env.LEAD_SEARCH_DAILY_LIMIT;

  beforeAll(async () => {
    db = await setupTestDb(url!);
    await db.delete(jobs).where(eq(jobs.type, "lead_search"));
    process.env.LEAD_SEARCH_DAILY_LIMIT = "2";
  });
  afterAll(() => {
    if (prev === undefined) delete process.env.LEAD_SEARCH_DAILY_LIMIT;
    else process.env.LEAD_SEARCH_DAILY_LIMIT = prev;
  });

  it("allows searches up to the limit, then refuses", async () => {
    const p = { category: "pizzerie", city: "Brno" };
    // Two at once: the advisory lock must not let a third one through later.
    const [a, b] = await Promise.all([reserveLeadSearch(db, p, "x"), reserveLeadSearch(db, p, "x")]);
    expect("jobId" in a && "jobId" in b).toBe(true);
    const c = await reserveLeadSearch(db, p, "x");
    expect(c).toEqual({ error: expect.stringContaining("limit 2") });
    expect(await leadSearchQuota(db)).toEqual({ used: 2, limit: 2, remaining: 0 });
  });

  it("does not count yesterday's searches", async () => {
    await db.update(jobs).set({ createdAt: sql`now() - interval '1 day 1 hour'` }).where(eq(jobs.type, "lead_search"));
    expect((await leadSearchQuota(db)).remaining).toBe(2);
    expect("jobId" in (await reserveLeadSearch(db, { category: "kavárna", city: "Praha" }, "x"))).toBe(true);
  });

  it("limit 0 disables searching", async () => {
    process.env.LEAD_SEARCH_DAILY_LIMIT = "0";
    expect(await reserveLeadSearch(db, { category: "a b", city: "c d" }, "x")).toEqual({
      error: expect.stringContaining("vypnuté"),
    });
    process.env.LEAD_SEARCH_DAILY_LIMIT = "2";
  });
});
