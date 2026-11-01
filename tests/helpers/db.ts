import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb, type Database } from "@/db/client";
import { runSeed } from "@/db/seed";

/** Fresh schema + seed in the throwaway TEST_DATABASE_URL database. */
export async function setupTestDb(url: string): Promise<Database> {
  const db = createDb(url, { max: 1 });
  await db.execute(
    sql`DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;`,
  );
  await migrate(db, { migrationsFolder: "drizzle" });
  await runSeed(db);
  return db;
}
