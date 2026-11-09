import "server-only";
import { createDb, type Database } from "./client";

const globalForDb = globalThis as unknown as { __db?: Database };

export function getDb(): Database {
  if (!globalForDb.__db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    globalForDb.__db = createDb(url);
  }
  return globalForDb.__db;
}

/** Lazily-initialised database handle: no connection is opened at import/build time. */
export const db = new Proxy({} as Database, {
  get(_target, prop) {
    return Reflect.get(getDb(), prop);
  },
});

export type { Database };
