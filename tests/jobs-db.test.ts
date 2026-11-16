// Integration: removing a job (website). Requires TEST_DATABASE_URL; skipped otherwise.
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/db/client";
import { builderProjects, clients, packageOffers, subscriptionEvents, subscriptions, websites } from "@/db/schema";
import { cancelSubscription, createSubscription } from "@/server/billing/subscriptions";
import { deleteJob } from "@/server/websites/jobs";
import { setupTestDb } from "./helpers/db";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("delete job (DB)", () => {
  let db: Database;
  let clientId: string;

  beforeAll(async () => {
    db = await setupTestDb(url!);
    const [c] = await db.insert(clients).values({ businessName: "Mazací klient" }).returning();
    clientId = c.id;
  });

  const offer = (websiteId: string) => ({
    clientId,
    websiteId,
    budgetHalere: 100000,
    packages: [0, 1, 2].map((i) => ({
      tierId: null,
      name: `B${i}`,
      priceHalere: 50000 + i * 10000,
      features: [],
      recommended: i === 2,
    })),
  });

  it("removes a job with its calculated packages, keeps Builder projects", async () => {
    const [web] = await db.insert(websites).values({ clientId, name: "Zakázka bez předplatného" }).returning();
    await db.insert(packageOffers).values(offer(web.id));
    const [proj] = await db.insert(builderProjects).values({ name: "Návrh", websiteId: web.id }).returning();
    expect(await deleteJob(db, web.id)).toEqual({ name: "Zakázka bez předplatného" });
    expect(await db.query.websites.findFirst({ where: eq(websites.id, web.id) })).toBeUndefined();
    expect(await db.select().from(packageOffers).where(eq(packageOffers.websiteId, web.id))).toHaveLength(0);
    const kept = await db.query.builderProjects.findFirst({ where: eq(builderProjects.id, proj.id) });
    expect(kept?.websiteId).toBeNull();
  });

  it("refuses while the subscription runs, removes it once cancelled", async () => {
    const sub = await createSubscription(db, {
      clientId,
      newWebsite: { name: "Zakázka s předplatným" },
      name: "Standard",
      priceHalere: 99000,
      features: [],
      startedOn: "2026-01-01",
      paidUntil: "2026-12-31",
    });
    await expect(deleteJob(db, sub.websiteId)).rejects.toThrow("nejdřív ho");
    await cancelSubscription(db, sub.id, "test");
    await deleteJob(db, sub.websiteId);
    expect(await db.query.subscriptions.findFirst({ where: eq(subscriptions.id, sub.id) })).toBeUndefined();
    expect(
      await db.select().from(subscriptionEvents).where(eq(subscriptionEvents.subscriptionId, sub.id)),
    ).toHaveLength(0);
  });
});
