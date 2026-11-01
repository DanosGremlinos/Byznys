import "server-only";
import { eq, inArray } from "drizzle-orm";
import type { Database } from "@/db/client";
import { emailBlacklist } from "@/db/schema";
import { normalizeEmail } from "./render";

type Reason = (typeof emailBlacklist.$inferInsert)["reason"];

export async function isBlacklisted(db: Database, email: string): Promise<boolean> {
  const row = await db.query.emailBlacklist.findFirst({
    where: eq(emailBlacklist.email, normalizeEmail(email)),
  });
  return Boolean(row);
}

export async function blacklistedAmong(db: Database, emails: string[]): Promise<Set<string>> {
  const list = [...new Set(emails.map(normalizeEmail))];
  if (!list.length) return new Set();
  const rows = await db
    .select({ email: emailBlacklist.email })
    .from(emailBlacklist)
    .where(inArray(emailBlacklist.email, list));
  return new Set(rows.map((r) => r.email));
}

export async function addToBlacklist(db: Database, email: string, reason: Reason, note?: string) {
  await db
    .insert(emailBlacklist)
    .values({ email: normalizeEmail(email), reason, note: note ?? null })
    .onConflictDoNothing({ target: emailBlacklist.email });
}
