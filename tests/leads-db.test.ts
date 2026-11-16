// Integration: deleting a lead. Requires TEST_DATABASE_URL; skipped otherwise.
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/db/client";
import { builderProjects, clients, leadPhotos, leadReviews, leads } from "@/db/schema";
import { deleteLead } from "@/server/leads/delete";
import { setupTestDb } from "./helpers/db";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("delete lead (DB)", () => {
  let db: Database;
  beforeAll(async () => {
    db = await setupTestDb(url!);
  });

  it("removes the lead with photos and reviews, keeps client and Builder project", async () => {
    const [lead] = await db.insert(leads).values({ name: "Smazat mě", placeId: "test-delete-1" }).returning();
    await db.insert(leadPhotos).values({ leadId: lead.id, url: "https://example.test/a.jpg", source: "google_places" });
    await db.insert(leadReviews).values({ leadId: lead.id, author: "A", rating: 5, text: "Super" });
    const [client] = await db.insert(clients).values({ businessName: "Z leadu", leadId: lead.id }).returning();
    const [proj] = await db.insert(builderProjects).values({ name: "Návrh", leadId: lead.id }).returning();

    expect(await deleteLead(db, lead.id)).toEqual({ name: "Smazat mě" });
    expect(await db.query.leads.findFirst({ where: eq(leads.id, lead.id) })).toBeUndefined();
    expect(await db.select().from(leadPhotos).where(eq(leadPhotos.leadId, lead.id))).toHaveLength(0);
    expect(await db.select().from(leadReviews).where(eq(leadReviews.leadId, lead.id))).toHaveLength(0);
    expect((await db.query.clients.findFirst({ where: eq(clients.id, client.id) }))?.leadId).toBeNull();
    expect((await db.query.builderProjects.findFirst({ where: eq(builderProjects.id, proj.id) }))?.leadId).toBeNull();
    expect(await deleteLead(db, lead.id)).toBeNull();
  });
});
