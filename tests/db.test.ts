// Integration test: applies the migrations to an empty database and runs the seed.
// Requires TEST_DATABASE_URL (a throwaway database); skipped otherwise.
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/db/client";
import { runSeed } from "@/db/seed";
import { setupTestDb } from "./helpers/db";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("database schema + seed", () => {
  let db: Database;

  beforeAll(async () => {
    db = await setupTestDb(url!);
  });

  afterAll(async () => {
    await db?.$close();
  });

  const one = async <T>(query: ReturnType<typeof sql>) => (await db.execute(query))[0] as T;

  it("creates all tables", async () => {
    const row = await one<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    expect(row.n).toBe(23);
  });

  it("seeds every module", async () => {
    for (const table of [
      "leads",
      "lead_photos",
      "lead_reviews",
      "lead_site_analyses",
      "clients",
      "websites",
      "builder_projects",
      "builder_assets",
      "email_templates",
      "email_threads",
      "emails",
      "contract_templates",
      "email_blacklist",
      "subscription_tiers",
      "subscriptions",
      "subscription_events",
      "dunning_runs",
      "dunning_steps",
      "jobs",
    ]) {
      const row = await one<{ n: number }>(sql`SELECT count(*)::int AS n FROM ${sql.identifier(table)}`);
      expect(row.n, table).toBeGreaterThan(0);
    }
  });

  it("is deterministic", async () => {
    const before = await db.execute(sql`SELECT name, city, rating FROM leads ORDER BY name`);
    await runSeed(db);
    const after = await db.execute(sql`SELECT name, city, rating FROM leads ORDER BY name`);
    expect([...after]).toEqual([...before]);
  });

  it("never has a sent email to a blacklisted address after it was blacklisted", async () => {
    const row = await one<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM emails e JOIN email_blacklist b ON lower(e.to_address) = b.email
      WHERE e.direction = 'outbound' AND e.status IN ('sent', 'approved', 'sending', 'pending_approval')
        AND e.created_at > b.created_at`);
    expect(row.n).toBe(0);
  });

  it("keeps dunning consistent: queued steps wait for approval, overdue subscriptions have runs", async () => {
    const queued = await one<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM dunning_steps s JOIN emails e ON e.id = s.email_id
      WHERE s.status = 'queued_for_approval' AND e.status <> 'pending_approval'`);
    expect(queued.n).toBe(0);
    const overdueWithoutRun = await one<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM subscriptions s
      LEFT JOIN dunning_runs r ON r.subscription_id = s.id AND r.missed_paid_until = s.paid_until
      WHERE s.status = 'active' AND s.paid_until < (now() AT TIME ZONE 'Europe/Prague')::date AND r.id IS NULL`);
    expect(overdueWithoutRun.n).toBe(0);
  });

  it("records payments as events whose paid-until matches the subscription", async () => {
    const row = await one<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM subscriptions s
      WHERE s.paid_until >= s.started_on AND s.paid_until <> (
        SELECT max(e.paid_until) FROM subscription_events e
        WHERE e.subscription_id = s.id AND e.type = 'payment_received')`);
    expect(row.n).toBe(0);
  });

  it("gives every subscription its own name, price and features", async () => {
    const row = await one<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM subscriptions
      WHERE name = '' OR price_halere <= 0 OR jsonb_array_length(features) = 0`);
    expect(row.n).toBe(0);
  });
});
