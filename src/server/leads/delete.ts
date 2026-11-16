import "server-only";
import { del } from "@vercel/blob";
import { eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { leadPhotos, leads } from "@/db/schema";
import { blobEnabled } from "@/lib/blob-config";

/**
 * Deletes a lead with its photos, reviews and website analyses (DB cascade). A client created from it,
 * email threads and Builder projects stay, just no longer linked to the lead. Photos copied to our Blob
 * storage are removed too (best effort). If a later search finds the business again, it comes back as new.
 */
export async function deleteLead(db: Database, leadId: string): Promise<{ name: string } | null> {
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, leadId), columns: { id: true, name: true } });
  if (!lead) return null;
  const photos = await db.select({ url: leadPhotos.url }).from(leadPhotos).where(eq(leadPhotos.leadId, leadId));
  await db.delete(leads).where(eq(leads.id, leadId));
  const blobUrls = photos.map((p) => p.url).filter((u) => /\.blob\.vercel-storage\.com\//.test(u));
  if (blobUrls.length && blobEnabled()) {
    try {
      await del(blobUrls);
    } catch (err) {
      console.error(`[leads] photo cleanup failed: ${err instanceof Error ? err.message : err}`);
    }
  }
  return { name: lead.name };
}
