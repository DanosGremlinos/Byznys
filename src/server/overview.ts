import "server-only";
import { count } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { clients, dunningRuns, emails, leads, subscriptions, websites } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-guard";

const TABLES: { label: string; table: PgTable }[] = [
  { label: "Leady", table: leads },
  { label: "Klienti", table: clients },
  { label: "Weby", table: websites },
  { label: "Předplatné", table: subscriptions },
  { label: "Upomínky", table: dunningRuns },
  { label: "E-maily", table: emails },
];

/** Row counts of the main tables (Phase 0 sanity check that the DB and seed are connected). */
export async function getDatabaseOverview() {
  await requireAdmin();
  return Promise.all(
    TABLES.map(async ({ label, table }) => {
      const [row] = await db.select({ value: count() }).from(table);
      return { label, count: row?.value ?? 0 };
    }),
  );
}
