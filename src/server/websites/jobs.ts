import "server-only";
import { and, desc, eq, isNull, ne } from "drizzle-orm";
import type { Database } from "@/db/client";
import { builderProjects, clients, emailThreads, leads, subscriptions, websites } from "@/db/schema";

// A "zakázka" (job) is a website record. It exists from the moment the deal gets serious (L2 contract,
// or "Založit zakázku" in the Builder), so it shows on the dashboard before any subscription exists.

type Client = typeof clients.$inferSelect;
type Website = typeof websites.$inferSelect;

/** Creates a client record from a lead (or returns the existing one). */
export async function ensureClientForLead(db: Database, leadId: string): Promise<Client> {
  const existing = await db.query.clients.findFirst({ where: eq(clients.leadId, leadId) });
  if (existing) return existing;
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, leadId) });
  if (!lead) throw new Error("Lead nenalezen");
  const [client] = await db
    .insert(clients)
    .values({
      businessName: lead.name,
      contactPerson: lead.contactPerson,
      email: lead.email,
      phone: lead.phone,
      address: lead.address,
      city: lead.city,
      leadId: lead.id,
    })
    .returning();
  // Conversations with the lead now belong to the client too (dashboard badges, job detail).
  await db
    .update(emailThreads)
    .set({ clientId: client.id })
    .where(and(eq(emailThreads.leadId, lead.id), isNull(emailThreads.clientId)));
  return client;
}

/**
 * Returns the client's open job (newest website that is not cancelled), creating one if there is none.
 * Builder projects of the client's lead that have no job yet are attached to it.
 */
export async function ensureJobForClient(
  db: Database,
  client: Client,
  opts: { name?: string | null; domain?: string | null; previewUrl?: string | null } = {},
): Promise<{ website: Website; created: boolean }> {
  let website = await db.query.websites.findFirst({
    where: and(eq(websites.clientId, client.id), ne(websites.status, "cancelled")),
    orderBy: desc(websites.updatedAt),
  });
  let created = false;
  if (!website) {
    const domain = opts.domain?.trim() || null;
    [website] = await db
      .insert(websites)
      .values({
        clientId: client.id,
        name: opts.name?.trim() || client.businessName,
        domain,
        status: "in_progress",
        previewUrl: opts.previewUrl || null,
        liveUrl: domain ? `https://${domain}` : null,
      })
      .returning();
    created = true;
  } else if (opts.previewUrl && !website.previewUrl) {
    [website] = await db
      .update(websites)
      .set({ previewUrl: opts.previewUrl, updatedAt: new Date() })
      .where(eq(websites.id, website.id))
      .returning();
  }
  if (client.leadId)
    await db
      .update(builderProjects)
      .set({ websiteId: website.id })
      .where(and(eq(builderProjects.leadId, client.leadId), isNull(builderProjects.websiteId)));
  return { website, created };
}

/** "Založit zakázku" in the Builder: client (from the lead or the form data) + job, linked to the project. */
export async function createJobFromProject(
  db: Database,
  projectId: string,
): Promise<{ website: Website; client: Client; created: boolean }> {
  const project = await db.query.builderProjects.findFirst({ where: eq(builderProjects.id, projectId) });
  if (!project) throw new Error("Projekt nenalezen");
  if (project.websiteId) {
    const website = await db.query.websites.findFirst({ where: eq(websites.id, project.websiteId) });
    const client = website && (await db.query.clients.findFirst({ where: eq(clients.id, website.clientId) }));
    if (website && client) return { website, client, created: false };
  }
  const info = project.clientInfo;
  let client: Client;
  if (project.leadId) client = await ensureClientForLead(db, project.leadId);
  else {
    if (!info.businessName?.trim()) throw new Error("Vyplňte v projektu název firmy klienta.");
    [client] = await db
      .insert(clients)
      .values({
        businessName: info.businessName.trim(),
        contactPerson: info.contactPerson ?? null,
        email: info.email ?? null,
        phone: info.phone ?? null,
        address: info.address ?? null,
        city: info.city ?? null,
      })
      .returning();
  }
  const { website, created } = await ensureJobForClient(db, client, {
    name: info.businessName,
    domain: info.domain,
  });
  await db
    .update(builderProjects)
    .set({ websiteId: website.id, updatedAt: new Date() })
    .where(eq(builderProjects.id, project.id));
  return { website, client, created };
}

/**
 * Removes a job (zakázka) from the dashboard: deletes the website record. Builder projects, contracts and
 * saved packages stay (their link to the job is cleared); the client, the lead and all emails stay too.
 * A job with a subscription can't be removed – the subscription holds the payment history.
 */
export async function deleteJob(db: Database, websiteId: string): Promise<void> {
  const website = await db.query.websites.findFirst({ where: eq(websites.id, websiteId) });
  if (!website) throw new Error("Zakázka nenalezena.");
  const sub = await db.query.subscriptions.findFirst({ where: eq(subscriptions.websiteId, websiteId) });
  if (sub)
    throw new Error(
      "Zakázka má předplatné (s historií plateb), proto ji nelze odebrat. Předplatné můžete zrušit v jeho detailu.",
    );
  await db.delete(websites).where(eq(websites.id, websiteId));
}
