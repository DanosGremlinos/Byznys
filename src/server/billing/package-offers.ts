import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { clients, packageOffers, subscriptionTiers, websites, type OfferedPackageJson } from "@/db/schema";
import { calculatePackages, type PackageCalculation } from "@/lib/package-calculator";

export type PackageOffer = typeof packageOffers.$inferSelect;

/** Active package templates in calculator order (Základ, Standard, Premium). */
export async function activeTemplates(db: Database) {
  return db
    .select({ id: subscriptionTiers.id, name: subscriptionTiers.name, features: subscriptionTiers.features })
    .from(subscriptionTiers)
    .where(eq(subscriptionTiers.isActive, true))
    .orderBy(asc(subscriptionTiers.sortOrder), asc(subscriptionTiers.name));
}

export async function calculateForBudget(db: Database, budgetHalere: number): Promise<PackageCalculation> {
  return calculatePackages(budgetHalere, await activeTemplates(db));
}

export type SavePackageOfferInput = {
  clientId: string;
  websiteId?: string | null;
  budgetHalere: number;
  packages: OfferedPackageJson[];
  note?: string | null;
};

/** Attaches a calculated (and possibly hand-edited) set of three packages to the client and the job. */
export async function savePackageOffer(db: Database, input: SavePackageOfferInput): Promise<PackageOffer> {
  const client = await db.query.clients.findFirst({ where: eq(clients.id, input.clientId) });
  if (!client) throw new Error("Klient nenalezen");
  if (input.websiteId) {
    const web = await db.query.websites.findFirst({ where: eq(websites.id, input.websiteId) });
    if (!web || web.clientId !== client.id) throw new Error("Zakázka nepatří tomuto klientovi");
  }
  if (input.budgetHalere <= 0) throw new Error("Rozpočet musí být kladný");
  if (input.packages.length !== 3) throw new Error("Nabídka musí mít 3 balíčky");
  for (const p of input.packages) {
    if (!p.name.trim()) throw new Error("Každý balíček musí mít název");
    if (!Number.isInteger(p.priceHalere) || p.priceHalere <= 0) throw new Error(`Neplatná cena balíčku ${p.name}`);
  }
  const recommended = input.packages.filter((p) => p.recommended).length;
  const packages = input.packages.map((p, i) => ({
    tierId: p.tierId,
    name: p.name.trim(),
    priceHalere: p.priceHalere,
    features: p.features.map((f) => f.trim()).filter(Boolean),
    // Exactly one recommended package; default to the most expensive (last) one.
    recommended: recommended === 1 ? p.recommended : i === input.packages.length - 1,
  }));
  const [offer] = await db
    .insert(packageOffers)
    .values({
      clientId: client.id,
      websiteId: input.websiteId ?? null,
      budgetHalere: input.budgetHalere,
      packages,
      note: input.note?.trim() || null,
    })
    .returning();
  return offer;
}

export async function getPackageOffer(db: Database, id: string) {
  return (await db.query.packageOffers.findFirst({ where: eq(packageOffers.id, id) })) ?? null;
}

/** The newest offer for a client (optionally for one job). */
export async function latestOfferFor(db: Database, clientId: string, websiteId?: string | null) {
  const rows = await db
    .select()
    .from(packageOffers)
    .where(eq(packageOffers.clientId, clientId))
    .orderBy(desc(packageOffers.createdAt));
  return (websiteId ? rows.find((r) => r.websiteId === websiteId) : undefined) ?? rows[0] ?? null;
}

export async function markOfferEmailed(db: Database, offerId: string, emailId: string) {
  await db.update(packageOffers).set({ emailId, updatedAt: new Date() }).where(eq(packageOffers.id, offerId));
}

export async function markOfferChosen(db: Database, offerId: string, subscriptionId: string, chosenIndex: number) {
  await db
    .update(packageOffers)
    .set({ subscriptionId, chosenIndex, updatedAt: new Date() })
    .where(eq(packageOffers.id, offerId));
}

/** All saved offers, newest first, with client and job names (Tarify page, job detail). */
export async function listPackageOffers(db: Database, filter: { clientId?: string; websiteId?: string } = {}) {
  const rows = await db.query.packageOffers.findMany({
    where: filter.websiteId
      ? eq(packageOffers.websiteId, filter.websiteId)
      : filter.clientId
        ? eq(packageOffers.clientId, filter.clientId)
        : undefined,
    orderBy: desc(packageOffers.createdAt),
    with: {
      client: { columns: { id: true, businessName: true } },
      website: { columns: { id: true, name: true, domain: true } },
      email: { columns: { id: true, status: true, sentAt: true } },
      subscription: { columns: { id: true, name: true, priceHalere: true, status: true } },
    },
  });
  return rows;
}

/** Clients and their jobs (websites) for the calculator's pickers. */
export async function calculatorOptions(db: Database) {
  const [clientRows, websiteRows, templates] = await Promise.all([
    db.select({ id: clients.id, name: clients.businessName }).from(clients).orderBy(asc(clients.businessName)),
    db
      .select({ id: websites.id, clientId: websites.clientId, name: websites.name, domain: websites.domain })
      .from(websites)
      .orderBy(desc(websites.updatedAt)),
    activeTemplates(db),
  ]);
  return { clients: clientRows, websites: websiteRows, templates };
}
