import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function createDb(url: string, options: { max?: number } = {}) {
  // prepare: false keeps it compatible with Neon's pooled (PgBouncer) endpoint.
  const client = postgres(url, { prepare: false, max: options.max ?? 5, onnotice: () => {} });
  return Object.assign(drizzle(client, { schema, casing: "snake_case" }), { $close: () => client.end() });
}

export type Database = ReturnType<typeof createDb>;
