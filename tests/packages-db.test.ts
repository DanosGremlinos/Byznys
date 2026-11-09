// Integration: package calculator offers, budget question, L3 with offers, jobs (zakázky).
// Requires TEST_DATABASE_URL; skipped otherwise.
import { and, eq, isNull, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/db/client";
import {
  builderProjects,
  clients,
  emailBlacklist,
  emailTemplates,
  emails,
  leads,
  packageOffers,
  websites,
} from "@/db/schema";
import {
  calculateForBudget,
  deletePackageOffer,
  markOfferChosen,
  savePackageOffer,
} from "@/server/billing/package-offers";
import { createSubscription } from "@/server/billing/subscriptions";
import { createOfferDraft } from "@/server/messaging/compose";
import { createJobFromProject, deleteJob } from "@/server/websites/jobs";
import { getJobDetail } from "@/server/websites/queries";
import { setupTestDb } from "./helpers/db";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("packages and jobs (DB)", () => {
  let db: Database;
  let demo: typeof clients.$inferSelect;
  let demoSite: typeof websites.$inferSelect;

  beforeAll(async () => {
    db = await setupTestDb(url!);
    demo = (await db.query.clients.findFirst({ where: eq(clients.businessName, "Cukrárna U Zlaté lžičky") }))!;
    demoSite = (await db.query.websites.findFirst({ where: eq(websites.clientId, demo.id) }))!;
  });
  afterAll(async () => {
    await db?.$close();
  });

  it("seeds a job that is waiting for the L3 email", async () => {
    const job = await getJobDetail(db, demoSite.id);
    expect(job?.stage.key).toBe("packages_ready");
    expect(job?.offers).toHaveLength(1);
    expect(job?.offers[0].packages.map((p) => p.priceHalere / 100)).toEqual([490, 990, 1090]);
  });

  it("calculates from the active templates and saves the offer to the client's job", async () => {
    const calc = await calculateForBudget(db, 150_000);
    expect(calc.packages.map((p) => p.name)).toEqual(["Základ", "Standard", "Premium"]);
    const offer = await savePackageOffer(db, {
      clientId: demo.id,
      websiteId: demoSite.id,
      budgetHalere: calc.budgetHalere,
      packages: calc.packages,
    });
    expect(offer.packages.filter((p) => p.recommended)).toHaveLength(1);
    const other = await db.query.websites.findFirst({ where: sql`${websites.clientId} <> ${demo.id}` });
    await expect(
      savePackageOffer(db, { clientId: demo.id, websiteId: other!.id, budgetHalere: 1, packages: calc.packages }),
    ).rejects.toThrow(/nepatří/);
  });

  it("creates the budget question (template is created on first use)", async () => {
    await db.delete(emailTemplates).where(eq(emailTemplates.key, "offer_budget_default"));
    const { emailId } = await createOfferDraft(db, { clientId: demo.id, level: "offer_budget", useAi: false });
    const email = await db.query.emails.findFirst({ where: eq(emails.id, emailId) });
    expect(email).toMatchObject({ kind: "offer_budget", status: "pending_approval" });
    expect(email?.bodyText).toContain("do správy webu měsíčně investovat");
    expect(await db.query.emailTemplates.findFirst({ where: eq(emailTemplates.key, "offer_budget_default") })).toBeTruthy();
  });

  it("puts the calculated packages into the L3 email and links it to the offer", async () => {
    const [offer] = await db.select().from(packageOffers).where(eq(packageOffers.clientId, demo.id)).limit(1);
    const { emailId } = await createOfferDraft(db, {
      clientId: demo.id,
      level: "offer_l3",
      packageOfferId: offer.id,
      useAi: false,
    });
    const email = await db.query.emails.findFirst({ where: eq(emails.id, emailId) });
    const premium = offer.packages.find((p) => p.recommended)!;
    expect(email?.bodyText).toContain(`★ ${premium.name}`);
    expect(email?.bodyText).toContain("(nejoblíbenější)");
    const updated = await db.query.packageOffers.findFirst({ where: eq(packageOffers.id, offer.id) });
    expect(updated?.emailId).toBe(emailId);

    const otherClient = await db.query.clients.findFirst({ where: sql`${clients.id} <> ${demo.id} and ${clients.email} is not null` });
    await db.delete(emailBlacklist).where(eq(emailBlacklist.email, otherClient!.email!.toLowerCase()));
    // Packages of another client are copied to the recipient; the original offer keeps its own status.
    const copied = await createOfferDraft(db, {
      clientId: otherClient!.id,
      level: "offer_l3",
      packageOfferId: offer.id,
      useAi: false,
    });
    expect(copied.warnings.join(" ")).toMatch(/zkopírovány/);
    const copy = await db.query.packageOffers.findFirst({ where: eq(packageOffers.emailId, copied.emailId) });
    expect(copy?.clientId).toBe(otherClient!.id);
    expect(copy?.packages).toEqual(offer.packages);
    expect((await db.query.packageOffers.findFirst({ where: eq(packageOffers.id, offer.id) }))?.emailId).toBe(emailId);
    await deletePackageOffer(db, copy!.id);
    expect(await db.query.packageOffers.findFirst({ where: eq(packageOffers.id, copy!.id) })).toBeUndefined();
  });

  it("L3 for a lead uses the packages of the client made from that lead", async () => {
    const [lead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.status, "new"), sql`${leads.email} is not null`))
      .orderBy(leads.name)
      .offset(5)
      .limit(1);
    await db.delete(emailBlacklist).where(eq(emailBlacklist.email, lead.email!.toLowerCase()));
    const [offer] = await db.select().from(packageOffers).where(eq(packageOffers.clientId, demo.id)).limit(1);
    const { emailId, warnings } = await createOfferDraft(db, {
      leadId: lead.id,
      level: "offer_l3",
      packageOfferId: offer.id,
      useAi: false,
    });
    expect(warnings.join(" ")).toMatch(/vytvořen klient/);
    const email = await db.query.emails.findFirst({ where: eq(emails.id, emailId) });
    expect(email?.bodyText).toContain("★ ");
  });

  it("marks the chosen package when the subscription is created", async () => {
    const [offer] = await db.select().from(packageOffers).where(eq(packageOffers.websiteId, demoSite.id)).limit(1);
    const pkg = offer.packages[2];
    const sub = await createSubscription(db, {
      clientId: demo.id,
      websiteId: demoSite.id,
      tierId: pkg.tierId,
      name: pkg.name,
      priceHalere: pkg.priceHalere,
      features: pkg.features,
      startedOn: "2026-11-05",
      paidUntil: "2026-11-04",
    });
    await markOfferChosen(db, offer.id, sub.id, 2);
    const job = await getJobDetail(db, demoSite.id);
    expect(job?.subscription?.name).toBe(pkg.name);
    expect(job?.offers.find((o) => o.id === offer.id)?.chosenIndex).toBe(2);
    expect(job?.stage.group).toBe("active");
  });

  it("creates the job at L2 and attaches the lead's builder project", async () => {
    const [lead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.status, "new"), sql`${leads.email} is not null`))
      .orderBy(leads.name)
      .offset(3)
      .limit(1);
    await db.delete(emailBlacklist).where(eq(emailBlacklist.email, lead.email!.toLowerCase()));
    const [project] = await db
      .insert(builderProjects)
      .values({ name: `Web – ${lead.name}`, leadId: lead.id })
      .returning();
    const { warnings, emailId } = await createOfferDraft(db, {
      leadId: lead.id,
      level: "offer_l2",
      webPriceHalere: 499_000,
      useAi: false,
    });
    expect(warnings.join(" ")).toMatch(/Založena zakázka/);
    expect(warnings.join(" ")).toMatch(/přiložit smlouvu/);
    // L2 = fixed one-time price for the website, no monthly packages; no contract generated by default.
    const l2 = await db.query.emails.findFirst({ where: eq(emails.id, emailId), with: { attachments: true } });
    expect(l2?.bodyText).toContain("4 990 Kč");
    expect(l2?.bodyText).not.toContain("měsíčně");
    expect(l2?.attachments).toHaveLength(0);
    const client = await db.query.clients.findFirst({ where: eq(clients.leadId, lead.id) });
    const site = await db.query.websites.findFirst({ where: eq(websites.clientId, client!.id) });
    expect(site?.status).toBe("in_progress");
    const linked = await db.query.builderProjects.findFirst({ where: eq(builderProjects.id, project.id) });
    expect(linked?.websiteId).toBe(site!.id);
    // A second L2 doesn't create another job.
    await createOfferDraft(db, { clientId: client!.id, level: "offer_l2", useAi: false });
    const all = await db.select().from(websites).where(eq(websites.clientId, client!.id));
    expect(all).toHaveLength(1);
  });

  it("creates a job from a Builder project", async () => {
    const [blank] = await db.insert(builderProjects).values({ name: "Nový projekt" }).returning();
    await expect(createJobFromProject(db, blank.id)).rejects.toThrow(/název firmy/);
    const [named] = await db
      .insert(builderProjects)
      .values({ name: "Web – Truhlářství Test", clientInfo: { businessName: "Truhlářství Test", domain: "truhlarstvi-test.cz" } })
      .returning();
    const first = await createJobFromProject(db, named.id);
    expect(first.created).toBe(true);
    expect(first.website.domain).toBe("truhlarstvi-test.cz");
    const again = await createJobFromProject(db, named.id);
    expect(again.website.id).toBe(first.website.id);
    expect(
      await db.query.builderProjects.findFirst({
        where: and(eq(builderProjects.id, named.id), isNull(builderProjects.websiteId)),
      }),
    ).toBeUndefined();
  });

  it("removes a job without a subscription, keeping the client and its saved packages", async () => {
    const [client] = await db.insert(clients).values({ businessName: "Mazací test" }).returning();
    const [site] = await db.insert(websites).values({ clientId: client.id, name: "Mazací test" }).returning();
    const calc = await calculateForBudget(db, 100_000);
    const offer = await savePackageOffer(db, {
      clientId: client.id,
      websiteId: site.id,
      budgetHalere: calc.budgetHalere,
      packages: calc.packages,
    });
    await deleteJob(db, site.id);
    expect(await db.query.websites.findFirst({ where: eq(websites.id, site.id) })).toBeUndefined();
    expect(await db.query.clients.findFirst({ where: eq(clients.id, client.id) })).toBeTruthy();
    expect((await db.query.packageOffers.findFirst({ where: eq(packageOffers.id, offer.id) }))?.websiteId).toBeNull();
    // A job with a subscription can't be removed.
    await expect(deleteJob(db, demoSite.id)).rejects.toThrow(/předplatné/);
  });
});
