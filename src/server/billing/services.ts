import "server-only";
import { asc, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { services } from "@/db/schema";

export type Service = typeof services.$inferSelect;

/** All services (active and inactive) in calculator order. */
export async function listServices(db: Database): Promise<Service[]> {
  return db.select().from(services).orderBy(asc(services.sortOrder), asc(services.name));
}

export type ServiceInput = {
  name: string;
  description: string | null;
  monthlyPriceHalere: number;
  required: boolean;
  sortOrder: number;
  isActive: boolean;
};

export async function upsertService(db: Database, id: string | null, input: ServiceInput) {
  if (input.monthlyPriceHalere < 0) throw new Error("Cena nesmí být záporná");
  if (id) await db.update(services).set({ ...input, updatedAt: new Date() }).where(eq(services.id, id));
  else await db.insert(services).values(input);
}

/** Saved packages keep their copy of the service names, so deleting a service changes nothing already offered. */
export async function deleteService(db: Database, id: string) {
  await db.delete(services).where(eq(services.id, id));
}
