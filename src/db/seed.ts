/**
 * Seed: wipes all app tables and fills them with realistic, deterministic fake Czech
 * data. Development / preview databases only. CLI entry point: ./seed-cli.ts
 */
import { and, eq, lt, sql } from "drizzle-orm";
import { pragueToday } from "../lib/format";
import type { Database } from "./client";
import * as s from "./schema";
import {
  CATEGORIES,
  CITIES,
  DESIGN_ISSUES,
  FIRST_NAMES_F,
  FIRST_NAMES_M,
  LAST_NAMES_F,
  LAST_NAMES_M,
  REVIEW_TEXTS,
  slugify,
  type CategoryInfo,
  type CityInfo,
} from "./seed-data";

// ---------------------------------------------------------------------------
// Deterministic randomness & date helpers
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let rand = mulberry32(20261101);
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const chance = (p: number) => rand() < p;
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
function sample<T>(arr: readonly T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
  return out;
}

const DAY = 86_400_000;
const NOW = new Date();
const TODAY = pragueToday(NOW); // yyyy-mm-dd in Europe/Prague
const daysAgo = (n: number, hour = 10) => {
  const d = new Date(NOW.getTime() - n * DAY);
  d.setUTCHours(hour - 1, int(0, 59), 0, 0); // ~hour in Prague (CET)
  return d;
};

function addDaysStr(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
function addMonthsStr(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + months, d)).toISOString().slice(0, 10);
}
const strToDate = (date: string, hour = 10) =>
  new Date(`${date}T${String(hour - 1).padStart(2, "0")}:00:00Z`);
const daysBetween = (a: string, b: string) =>
  Math.round((strToDate(b).getTime() - strToDate(a).getTime()) / DAY);

const kc = (czk: number) => czk * 100;

function personName(): { full: string; short: string } {
  if (chance(0.5)) {
    const first = pick(FIRST_NAMES_M);
    const last = pick(LAST_NAMES_M);
    return { full: `${first} ${last}`, short: `${first} ${last[0]}.` };
  }
  const first = pick(FIRST_NAMES_F);
  const last = pick(LAST_NAMES_F);
  return { full: `${first} ${last}`, short: `${first} ${last[0]}.` };
}

function phone() {
  const prefix = pick([
    "601",
    "602",
    "603",
    "604",
    "605",
    "606",
    "608",
    "720",
    "724",
    "732",
    "736",
    "739",
    "775",
    "777",
  ]);
  return `+420 ${prefix} ${int(100, 999)} ${int(100, 999)}`;
}

function ico() {
  return String(int(10_000_000, 99_999_999));
}

const SENDER = process.env.EMAIL_FROM ?? "Webové stránky <nabidky@example.cz>";
const SENDER_ADDRESS = SENDER.match(/<(.+)>/)?.[1] ?? SENDER;
const messageId = () => `<seed-${Math.floor(rand() * 1e12).toString(36)}@example.cz>`;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export type SeedSummary = { table: string; n: number }[];

export async function runSeed(db: Database): Promise<SeedSummary> {
  rand = mulberry32(20261101); // same data on every run
  return db.transaction(async (tx) => {
    await tx.execute(sql`
        TRUNCATE TABLE
          dunning_steps, dunning_runs, invoices, subscription_events, subscriptions, subscription_tiers,
          webhook_events, email_blacklist, contracts, contract_templates, email_attachments, emails,
          email_threads, email_templates, builder_prompt_versions, builder_assets, builder_projects,
          websites, clients, lead_site_analyses, lead_reviews, lead_photos, leads, jobs
        RESTART IDENTITY CASCADE
      `);

    // ---- Jobs -------------------------------------------------------------
    const [jobPizzaBrno] = await tx
      .insert(s.jobs)
      .values([
        {
          type: "lead_search",
          status: "succeeded",
          params: { category: "pizzerie", city: "Brno" },
          progress: { done: 7, total: 7, message: "Hotovo" },
          result: { found: 7, analysed: 7 },
          attempts: 0,
          runAfter: daysAgo(12),
          startedAt: daysAgo(12),
          finishedAt: daysAgo(12),
          createdAt: daysAgo(12),
        },
        {
          type: "site_analysis",
          status: "succeeded",
          params: { scope: "all-with-website" },
          progress: { done: 31, total: 31 },
          result: { analysed: 31 },
          runAfter: daysAgo(10),
          startedAt: daysAgo(10),
          finishedAt: daysAgo(10),
          createdAt: daysAgo(10),
        },
        {
          type: "lead_search",
          status: "failed",
          params: { category: "truhlářství", city: "Jihlava" },
          progress: { done: 0, total: 0 },
          error: "Places API: REQUEST_DENIED (ukázková chyba ze seed dat)",
          attempts: 3,
          runAfter: daysAgo(3),
          startedAt: daysAgo(3),
          finishedAt: daysAgo(3),
          createdAt: daysAgo(3),
        },
      ])
      .returning();

    // ---- Leads ------------------------------------------------------------
    type LeadSeed = {
      row: typeof s.leads.$inferInsert;
      category: CategoryInfo;
      city: CityInfo;
      slug: string;
      hasWebsite: boolean;
    };
    const leadSeeds: LeadSeed[] = [];
    const cityWeights = [CITIES[0], CITIES[0], CITIES[0], ...CITIES]; // Brno-heavy
    let placeSeq = 1;
    for (const category of CATEGORIES) {
      for (const name of category.names) {
        const city =
          category.key === "pizzerie" && leadSeeds.filter((l) => l.category.key === "pizzerie").length < 4
            ? CITIES[0]
            : pick(cityWeights);
        const slug = slugify(name);
        const hasWebsite = chance(0.7);
        const https = chance(0.6);
        const websiteUrl = hasWebsite ? (https ? `https://www.${slug}.cz` : `http://www.${slug}.cz`) : null;
        const contact = chance(0.7) ? personName().full : null;
        const rating = Math.round((3.5 + rand() * 1.45) * 10) / 10;
        const reviewCount = chance(0.3) ? int(150, 650) : int(4, 140);
        const hasLogo = hasWebsite && chance(0.6);
        const placeId = `seed_place_${String(placeSeq++).padStart(3, "0")}`;
        leadSeeds.push({
          category,
          city,
          slug,
          hasWebsite,
          row: {
            placeId,
            searchJobId: category.key === "pizzerie" && city.name === "Brno" ? jobPizzaBrno.id : null,
            name,
            category: category.label,
            address: `${pick(city.streets)} ${int(1, 120)}, ${city.zip} ${city.name}`,
            city: city.name,
            lat: city.lat + (rand() - 0.5) * 0.04,
            lng: city.lng + (rand() - 0.5) * 0.06,
            phone: phone(),
            email: hasWebsite
              ? `info@${slug}.cz`
              : chance(0.5)
                ? `${slug.replace(/-/g, ".")}@seznam.cz`
                : null,
            websiteUrl,
            googleMapsUrl: `https://www.google.com/maps/place/?q=place_id:${placeId}`,
            openingHours: category.hours,
            services: hasWebsite ? sample(category.services, int(2, category.services.length)) : [],
            socialLinks: {
              ...(chance(0.7) ? { facebook: `https://www.facebook.com/${slug}` } : {}),
              ...(chance(0.45) ? { instagram: `https://www.instagram.com/${slug.replace(/-/g, "")}` } : {}),
            },
            rating,
            reviewCount,
            logoUrl: hasLogo
              ? `https://placehold.co/256x256/png?text=${encodeURIComponent(
                  name
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 3),
                )}`
              : null,
            brandColors: hasLogo
              ? sample(["#B91C1C", "#0F766E", "#1D4ED8", "#A16207", "#7C3AED", "#111827", "#F59E0B"], 2)
              : null,
            contactPerson: contact,
            status: "new",
            createdAt: daysAgo(int(1, 45)),
          },
        });
      }
    }

    // Lead statuses: converted (become clients), contacted, rejected, the rest new.
    const order = sample(
      leadSeeds.map((_, i) => i),
      leadSeeds.length,
    );
    const convertedIdx = order.slice(0, 6);
    const contactedIdx = order.slice(6, 16);
    const rejectedIdx = order.slice(16, 19);
    const newIdx = order.slice(19);
    for (const i of convertedIdx) leadSeeds[i].row.status = "converted";
    for (const i of contactedIdx) leadSeeds[i].row.status = "contacted";
    for (const i of rejectedIdx) leadSeeds[i].row.status = "rejected";
    // Leads in the pipeline must have an email address.
    for (const i of [...convertedIdx, ...contactedIdx, ...rejectedIdx]) {
      leadSeeds[i].row.email ??= `${leadSeeds[i].slug.replace(/-/g, ".")}@email.cz`;
      leadSeeds[i].row.createdAt = daysAgo(int(30, 120));
    }

    const insertedLeads = await tx
      .insert(s.leads)
      .values(leadSeeds.map((l) => l.row))
      .returning();

    // Photos, reviews, site analyses
    const photoRows: (typeof s.leadPhotos.$inferInsert)[] = [];
    const reviewRows: (typeof s.leadReviews.$inferInsert)[] = [];
    const analysisRows: (typeof s.leadSiteAnalyses.$inferInsert)[] = [];
    insertedLeads.forEach((lead, i) => {
      const seed = leadSeeds[i];
      const photoCount = int(2, 6);
      for (let k = 0; k < photoCount; k++) {
        photoRows.push({
          leadId: lead.id,
          url: `https://picsum.photos/seed/${seed.slug}-${k}/1200/800`,
          source: k === 0 && seed.hasWebsite ? "website" : "google_places",
          attribution: k === 0 && seed.hasWebsite ? null : "Fotografie z Google Maps",
          width: 1200,
          height: 800,
          sortOrder: k,
        });
      }
      for (const review of sample(REVIEW_TEXTS, int(3, 5))) {
        reviewRows.push({
          leadId: lead.id,
          author: personName().short,
          rating: review.rating,
          text: review.text,
          publishedAt: daysAgo(int(5, 700)),
        });
      }
      if (seed.hasWebsite && lead.websiteUrl) {
        const isHttps = lead.websiteUrl.startsWith("https://");
        const old = chance(0.55);
        const mobile = old ? int(12, 55) : int(45, 96);
        analysisRows.push({
          leadId: lead.id,
          url: lead.websiteUrl,
          finalUrl: lead.websiteUrl,
          fetchedAt: daysAgo(10),
          httpStatus: 200,
          isHttps,
          copyrightYear: old ? int(2009, 2017) : int(2019, 2025),
          techSignals: old
            ? {
                generator: pick([
                  "WordPress 4.9.8",
                  "Joomla! 1.5 - Open Source Content Management",
                  "Webnode",
                ]),
                usesJquery: true,
                jqueryVersion: pick(["1.4.2", "1.8.3", "1.12.4"]),
                tableLayout: chance(0.3),
              }
            : {
                generator: pick(["WordPress 6.6", "Webflow", "Wix.com Website Builder"]),
                usesJquery: chance(0.3),
              },
          hasTitle: chance(0.92),
          hasMetaDescription: old ? chance(0.3) : chance(0.75),
          hasH1: old ? chance(0.4) : chance(0.85),
          hasViewportMeta: old ? chance(0.25) : true,
          pagespeedMobile: mobile,
          pagespeedDesktop: Math.min(100, mobile + int(5, 30)),
          designIssues: old ? sample(DESIGN_ISSUES, int(2, 4)) : sample(DESIGN_ISSUES, int(0, 1)),
        });
      }
    });
    await tx.insert(s.leadPhotos).values(photoRows);
    const insertedReviews = await tx.insert(s.leadReviews).values(reviewRows).returning();
    await tx.insert(s.leadSiteAnalyses).values(analysisRows);

    // ---- Tiers ------------------------------------------------------------
    const [tierBasic, tierStandard, tierPremium] = await tx
      .insert(s.subscriptionTiers)
      .values([
        {
          name: "Základ",
          description: "Jednostránkový web pro živnostníky.",
          monthlyPriceHalere: kc(490),
          features: ["Jednostránkový web", "Hosting a doména", "SSL certifikát", "1 drobná úprava měsíčně"],
          sortOrder: 1,
        },
        {
          name: "Standard",
          description: "Vícestránkový web s galerií a ceníkem.",
          monthlyPriceHalere: kc(990),
          features: [
            "Až 6 podstránek",
            "Hosting a doména",
            "SSL certifikát",
            "Galerie a ceník",
            "Kontaktní formulář",
            "3 úpravy měsíčně",
            "Základní SEO",
          ],
          sortOrder: 2,
        },
        {
          name: "Premium",
          description: "Kompletní péče včetně rezervací a statistik.",
          monthlyPriceHalere: kc(1990),
          features: [
            "Neomezeně podstránek",
            "Hosting a doména",
            "SSL certifikát",
            "Rezervační systém",
            "Vícejazyčná verze",
            "Neomezené úpravy",
            "Měsíční report návštěvnosti",
            "Prioritní podpora",
          ],
          sortOrder: 3,
        },
      ])
      .returning();
    const tiers = [tierBasic, tierStandard, tierPremium];

    // ---- Clients & websites ----------------------------------------------
    type ClientSeed = { client: typeof s.clients.$inferSelect; slug: string; leadId: string | null };
    const clientSeeds: ClientSeed[] = [];

    const convertedLeads = convertedIdx.map((i) => ({ lead: insertedLeads[i], seed: leadSeeds[i] }));
    for (const { lead, seed } of convertedLeads) {
      const [client] = await tx
        .insert(s.clients)
        .values({
          businessName: lead.name,
          ico: ico(),
          contactPerson: lead.contactPerson ?? personName().full,
          email: lead.email,
          phone: lead.phone,
          address: lead.address,
          city: lead.city,
          leadId: lead.id,
          createdAt: daysAgo(int(60, 420)),
        })
        .returning();
      clientSeeds.push({ client, slug: seed.slug, leadId: lead.id });
    }
    const standalone = [
      "Restaurace Pod Kaštany",
      "Kadeřnictví Monika",
      "Stavebniny Doležal",
      "Penzion U Lípy",
      "Fitness centrum Atlas",
      "Květinářství Fialka",
    ];
    for (const name of standalone) {
      const city = pick(CITIES);
      const slug = slugify(name);
      const [client] = await tx
        .insert(s.clients)
        .values({
          businessName: name,
          ico: ico(),
          dic: chance(0.5) ? `CZ${ico()}` : null,
          contactPerson: personName().full,
          email: `info@${slug}.cz`,
          phone: phone(),
          address: `${pick(city.streets)} ${int(1, 99)}, ${city.zip} ${city.name}`,
          city: city.name,
          createdAt: daysAgo(int(60, 420)),
        })
        .returning();
      clientSeeds.push({ client, slug, leadId: null });
    }

    // Website plan: 10 live + 1 suspended + 1 cancelled + 1 in progress (second site of client 0).
    type SiteSeed = {
      website: typeof s.websites.$inferSelect;
      clientSeed: ClientSeed;
      plan: "live" | "suspended" | "cancelled" | "in_progress";
    };
    const siteSeeds: SiteSeed[] = [];
    const plans: SiteSeed["plan"][] = [
      "live",
      "live",
      "live",
      "live",
      "live",
      "live",
      "live",
      "live",
      "live",
      "suspended",
      "live",
      "cancelled",
    ];
    for (let i = 0; i < clientSeeds.length; i++) {
      const cs = clientSeeds[i];
      const plan = plans[i];
      const domain = `${cs.slug}.cz`;
      const [website] = await tx
        .insert(s.websites)
        .values({
          clientId: cs.client.id,
          name: cs.client.businessName,
          domain,
          status: plan,
          liveUrl: `https://${domain}`,
          previewUrl: `https://${cs.slug}.vercel.app`,
          launchedAt: daysAgo(int(30, 400)),
        })
        .returning();
      siteSeeds.push({ website, clientSeed: cs, plan });
    }
    {
      const cs = clientSeeds[0];
      const [website] = await tx
        .insert(s.websites)
        .values({
          clientId: cs.client.id,
          name: `${cs.client.businessName} – rozvoz`,
          domain: `rozvoz-${cs.slug}.cz`,
          status: "in_progress",
          previewUrl: `https://rozvoz-${cs.slug}.vercel.app`,
        })
        .returning();
      siteSeeds.push({ website, clientSeed: cs, plan: "in_progress" });
    }

    // ---- Subscriptions, events, invoices ---------------------------------
    type InvoiceDraft = Omit<typeof s.invoices.$inferInsert, "number" | "variableSymbol">;
    const invoiceDrafts: InvoiceDraft[] = [];
    const eventRows: (typeof s.subscriptionEvents.$inferInsert)[] = [];
    const subsBySite = new Map<string, typeof s.subscriptions.$inferSelect>();

    for (const site of siteSeeds) {
      if (site.plan === "in_progress") continue;
      const monthsAgo = int(2, 14);
      const startedOn = addMonthsStr(addDaysStr(TODAY, -int(0, 27)), -monthsAgo);
      let tierIdx = pick([0, 0, 0, 1, 1, 1, 2]);
      const upgradeAt = tierIdx < 2 && monthsAgo > 4 && chance(0.4) ? int(2, monthsAgo - 1) : null;
      const downgradeAt =
        upgradeAt === null && tierIdx > 0 && monthsAgo > 5 && chance(0.2) ? int(3, monthsAgo - 1) : null;
      const discount = chance(0.2) ? 0.9 : 1;
      const priceFor = (idx: number) => Math.round((tiers[idx].monthlyPriceHalere * discount) / 1000) * 1000;
      const initialTier = tierIdx;
      const finalTier = upgradeAt !== null ? tierIdx + 1 : downgradeAt !== null ? tierIdx - 1 : tierIdx;
      const cancelled = site.plan === "cancelled";
      const cancelAfterMonths = cancelled ? Math.max(1, monthsAgo - 1) : null;

      let nextBilling = startedOn;
      while (nextBilling <= TODAY) nextBilling = addMonthsStr(nextBilling, 1);

      const [sub] = await tx
        .insert(s.subscriptions)
        .values({
          clientId: site.clientSeed.client.id,
          websiteId: site.website.id,
          tierId: tiers[finalTier].id,
          status: cancelled ? "cancelled" : "active",
          priceHalere: priceFor(finalTier),
          startedOn,
          nextBillingDate: cancelled ? null : nextBilling,
          cancelledAt: cancelled ? strToDate(addMonthsStr(startedOn, cancelAfterMonths!)) : null,
          cancelReason: cancelled ? "Ukončení podnikání" : null,
          createdAt: strToDate(startedOn),
        })
        .returning();
      subsBySite.set(site.website.id, sub);

      eventRows.push({
        subscriptionId: sub.id,
        clientId: sub.clientId,
        type: "created",
        toTierId: tiers[initialTier].id,
        toPriceHalere: priceFor(initialTier),
        amountHalere: priceFor(initialTier),
        note: "Nové předplatné",
        occurredAt: strToDate(startedOn, 11),
      });

      // Monthly invoices from start until the current period (or cancellation).
      for (let m = 0; ; m++) {
        const periodStart = addMonthsStr(startedOn, m);
        if (periodStart > TODAY) break;
        if (cancelAfterMonths !== null && m >= cancelAfterMonths) break;
        if (upgradeAt !== null && m === upgradeAt) {
          eventRows.push({
            subscriptionId: sub.id,
            clientId: sub.clientId,
            type: "upgraded",
            fromTierId: tiers[tierIdx].id,
            toTierId: tiers[tierIdx + 1].id,
            fromPriceHalere: priceFor(tierIdx),
            toPriceHalere: priceFor(tierIdx + 1),
            occurredAt: strToDate(addDaysStr(periodStart, -2), 14),
          });
          tierIdx += 1;
        }
        if (downgradeAt !== null && m === downgradeAt) {
          eventRows.push({
            subscriptionId: sub.id,
            clientId: sub.clientId,
            type: "downgraded",
            fromTierId: tiers[tierIdx].id,
            toTierId: tiers[tierIdx - 1].id,
            fromPriceHalere: priceFor(tierIdx),
            toPriceHalere: priceFor(tierIdx - 1),
            occurredAt: strToDate(addDaysStr(periodStart, -3), 9),
          });
          tierIdx -= 1;
        }
        const dueDate = addDaysStr(periodStart, 14);
        // Past-due invoices are paid by today (overdue ones are set up explicitly below).
        const maxOffset = dueDate < TODAY ? Math.min(16, daysBetween(periodStart, TODAY)) : 16;
        const paidOn = addDaysStr(periodStart, int(1, maxOffset));
        const isPaid = paidOn <= TODAY && (dueDate < TODAY || chance(0.5));
        invoiceDrafts.push({
          subscriptionId: sub.id,
          clientId: sub.clientId,
          amountHalere: priceFor(tierIdx),
          periodStart,
          periodEnd: addDaysStr(addMonthsStr(periodStart, 1), -1),
          issuedOn: periodStart,
          dueDate,
          status: isPaid ? "paid" : "issued",
          paidAt: isPaid ? strToDate(paidOn, 12) : null,
          paidAmountHalere: isPaid ? priceFor(tierIdx) : null,
        });
        if (m > 0) {
          eventRows.push({
            subscriptionId: sub.id,
            clientId: sub.clientId,
            type: "renewed",
            amountHalere: priceFor(tierIdx),
            occurredAt: strToDate(periodStart, 8),
          });
        }
        if (isPaid) {
          eventRows.push({
            subscriptionId: sub.id,
            clientId: sub.clientId,
            type: "payment_received",
            amountHalere: priceFor(tierIdx),
            occurredAt: strToDate(paidOn, 12),
          });
        }
      }

      if (cancelled) {
        eventRows.push({
          subscriptionId: sub.id,
          clientId: sub.clientId,
          type: "cancelled",
          fromTierId: tiers[tierIdx].id,
          note: "Ukončení podnikání",
          occurredAt: sub.cancelledAt ?? strToDate(TODAY),
        });
      }
    }

    // Overdue scenarios: pick active subscriptions and make their latest past-due invoice unpaid.
    type OverduePlan = { daysOverdue: number; runStatus: "active" | "paused" | "completed" };
    const overduePlans: OverduePlan[] = [
      { daysOverdue: 1, runStatus: "active" },
      { daysOverdue: 4, runStatus: "active" },
      { daysOverdue: 6, runStatus: "paused" },
      { daysOverdue: 9, runStatus: "active" },
      { daysOverdue: 20, runStatus: "completed" }, // site suspended
    ];
    const suspendedSite = siteSeeds.find((x) => x.plan === "suspended")!;
    const activeSubs = siteSeeds
      .filter((x) => x.plan === "live")
      .map((x) => subsBySite.get(x.website.id)!)
      .filter(Boolean);
    const overdueSubs = [...activeSubs.slice(0, 4), subsBySite.get(suspendedSite.website.id)!];
    const overdueAssignments = new Map<InvoiceDraft, OverduePlan>();
    overdueSubs.forEach((sub, idx) => {
      const plan = overduePlans[idx];
      const candidates = invoiceDrafts.filter((d) => d.subscriptionId === sub.id && d.dueDate < TODAY);
      const target = candidates.at(-1) ?? invoiceDrafts.filter((d) => d.subscriptionId === sub.id).at(-1)!;
      const removed = target.status === "paid";
      target.dueDate = addDaysStr(TODAY, -plan.daysOverdue);
      target.issuedOn = addDaysStr(target.dueDate, -14);
      target.status = "issued";
      target.paidAt = null;
      target.paidAmountHalere = null;
      if (removed) {
        // Drop the matching payment_received event.
        const evIdx = eventRows.findIndex(
          (e) =>
            e.subscriptionId === sub.id &&
            e.type === "payment_received" &&
            e.amountHalere === target.amountHalere,
        );
        if (evIdx >= 0) eventRows.splice(evIdx, 1);
      }
      overdueAssignments.set(target, plan);
    });
    // A paid-late invoice whose dunning run was stopped by the payment.
    const paidLateSub = activeSubs[5];
    const paidLate = invoiceDrafts
      .filter(
        (d) =>
          d.subscriptionId === paidLateSub.id && d.status === "paid" && d.dueDate < addDaysStr(TODAY, -20),
      )
      .at(-1);
    if (paidLate) {
      const originalPaidAt = paidLate.paidAt?.getTime();
      paidLate.paidAt = strToDate(addDaysStr(paidLate.dueDate, 4), 15);
      const ev = eventRows.find(
        (e) =>
          e.subscriptionId === paidLateSub.id &&
          e.type === "payment_received" &&
          e.occurredAt?.getTime() === originalPaidAt,
      );
      if (ev) ev.occurredAt = paidLate.paidAt;
    }

    // Number invoices chronologically.
    invoiceDrafts.sort((a, b) => (a.issuedOn < b.issuedOn ? -1 : a.issuedOn > b.issuedOn ? 1 : 0));
    const seqByYear = new Map<string, number>();
    const invoiceRows = invoiceDrafts.map((d) => {
      const year = d.issuedOn.slice(0, 4);
      const seq = (seqByYear.get(year) ?? 0) + 1;
      seqByYear.set(year, seq);
      const num = `${year}-${String(seq).padStart(4, "0")}`;
      return { ...d, number: num, variableSymbol: `${year}${String(seq).padStart(4, "0")}` };
    });
    const insertedInvoices = await tx.insert(s.invoices).values(invoiceRows).returning();
    const invoiceByDraft = new Map<InvoiceDraft, typeof s.invoices.$inferSelect>();
    invoiceDrafts.forEach((d, i) => invoiceByDraft.set(d, insertedInvoices[i]));

    // Suspended website event
    const suspendedSub = subsBySite.get(suspendedSite.website.id)!;
    eventRows.push({
      subscriptionId: suspendedSub.id,
      clientId: suspendedSub.clientId,
      type: "website_suspended",
      note: "Pozastaveno po třetí upomínce",
      occurredAt: daysAgo(2, 9),
    });
    await tx.insert(s.subscriptionEvents).values(eventRows);

    // ---- Email templates & contract template ------------------------------
    const templates = await tx
      .insert(s.emailTemplates)
      .values([
        {
          key: "offer_l1_default",
          kind: "offer_l1",
          name: "L1 – první oslovení s náhledem",
          subject: "Návrh nového webu pro {{businessName}}",
          body: `Dobrý den{{contactGreeting}},

dívali jsme se na web {{businessName}} a všimli jsme si několika věcí, které vás mohou připravovat o zákazníky:

{{issues}}

Připravili jsme proto nezávazný návrh, jak by mohl vypadat váš nový web: {{previewUrl}}

Pokud se vám líbí, rád vám pošlu finální verzi a podmínky. Stačí odpovědět na tento e-mail.

S pozdravem
{{senderName}}

---
Nechcete dostávat další zprávy? Odhlásit se můžete zde: {{unsubscribeUrl}}`,
        },
        {
          key: "offer_l2_default",
          kind: "offer_l2",
          name: "L2 – finální návrh, smlouva a rozpočet",
          subject: "Finální návrh webu a smlouva – {{businessName}}",
          body: `Dobrý den{{contactGreeting}},

děkuji za odpověď. V příloze posílám finální návrh webu a smlouvu.

Náhled: {{previewUrl}}
Navrhované předplatné: {{tierName}} za {{monthlyPrice}} měsíčně (hosting, doména, údržba a úpravy).

V případě dotazů jsem k dispozici.

S pozdravem
{{senderName}}

---
Odhlásit se: {{unsubscribeUrl}}`,
        },
        {
          key: "offer_l3_default",
          kind: "offer_l3",
          name: "L3 – nabídka předplatného",
          subject: "Předplatné webu {{businessName}} – srovnání tarifů",
          body: `Dobrý den{{contactGreeting}},

posílám přehled tarifů, ze kterých si můžete vybrat:

{{tierComparison}}

Platbu můžete provést převodem na účet {{bankAccount}}, variabilní symbol vám pošlu s první fakturou.

S pozdravem
{{senderName}}

---
Odhlásit se: {{unsubscribeUrl}}`,
        },
        {
          key: "dunning_1_default",
          kind: "dunning_1",
          name: "Upomínka 1 – přátelská připomínka (den 0)",
          subject: "Připomínka platby – faktura {{invoiceNumber}}",
          body: `Dobrý den{{contactGreeting}},

jen přátelsky připomínám, že faktura {{invoiceNumber}} na částku {{amount}} byla splatná {{dueDate}}. Pokud jste již platili, považujte prosím tento e-mail za bezpředmětný.

S pozdravem
{{senderName}}`,
        },
        {
          key: "dunning_2_default",
          kind: "dunning_2",
          name: "Upomínka 2 – platební údaje (den 3)",
          subject: "Upomínka – faktura {{invoiceNumber}} je po splatnosti",
          body: `Dobrý den{{contactGreeting}},

faktura {{invoiceNumber}} na částku {{amount}} je {{daysOverdue}} dní po splatnosti.

Platební údaje:
Číslo účtu: {{bankAccount}}
Variabilní symbol: {{variableSymbol}}
Částka: {{amount}}

Děkuji za brzkou úhradu.

S pozdravem
{{senderName}}`,
        },
        {
          key: "dunning_3_default",
          kind: "dunning_3",
          name: "Upomínka 3 – poslední výzva (den 7)",
          subject: "Poslední výzva k úhradě – faktura {{invoiceNumber}}",
          body: `Dobrý den{{contactGreeting}},

faktura {{invoiceNumber}} na částku {{amount}} stále není uhrazena. Pokud platba nedorazí do 3 dnů, budu nucen web {{websiteDomain}} dočasně pozastavit.

Platební údaje:
Číslo účtu: {{bankAccount}}
Variabilní symbol: {{variableSymbol}}

S pozdravem
{{senderName}}`,
        },
      ])
      .returning();
    const tpl = Object.fromEntries(templates.map((t) => [t.kind, t])) as Record<
      string,
      (typeof templates)[number]
    >;

    await tx.insert(s.contractTemplates).values({
      name: "Smlouva o tvorbě a správě webu",
      isDefault: true,
      body: `# Smlouva o tvorbě a správě webových stránek

**Poskytovatel:** {{providerName}}, IČO {{providerIco}}
**Objednatel:** {{clientName}}, IČO {{clientIco}}, {{clientAddress}}

## 1. Předmět smlouvy
Poskytovatel vytvoří pro objednatele webové stránky na doméně {{domain}} a zajistí jejich provoz, hosting a údržbu.

## 2. Cena a platební podmínky
Měsíční předplatné činí {{monthlyPrice}} (tarif {{tierName}}). Splatnost faktur je 14 dní.

## 3. Doba trvání
Smlouva se uzavírá na dobu neurčitou s výpovědní lhůtou 1 měsíc.

## 4. Pozastavení služby
Při prodlení s úhradou delším než 10 dní může poskytovatel provoz webu pozastavit.

V {{city}} dne {{date}}

_______________________          _______________________
Poskytovatel                      Objednatel`,
    });

    // ---- Email threads ----------------------------------------------------
    const emailIdsForDunning = new Map<string, string>(); // key `${invoiceId}:${step}` → email id

    async function thread(opts: { clientId?: string | null; leadId?: string | null; subject: string }) {
      const [t] = await tx
        .insert(s.emailThreads)
        .values({
          clientId: opts.clientId ?? null,
          leadId: opts.leadId ?? null,
          subject: opts.subject,
          lastMessageAt: new Date(0), // bumped by each email below
        })
        .returning();
      return t;
    }
    async function email(
      threadId: string,
      data: Omit<typeof s.emails.$inferInsert, "threadId" | "messageIdHeader" | "fromAddress"> & {
        fromAddress?: string;
      },
    ) {
      const [row] = await tx
        .insert(s.emails)
        .values({ threadId, fromAddress: SENDER, messageIdHeader: messageId(), ...data })
        .returning();
      const when = row.sentAt ?? row.receivedAt ?? row.createdAt;
      await tx
        .update(s.emailThreads)
        .set({ lastMessageAt: when })
        .where(and(eq(s.emailThreads.id, threadId), lt(s.emailThreads.lastMessageAt, when)));
      return row;
    }
    const l1Body = (name: string) =>
      `Dobrý den,\n\ndívali jsme se na web ${name} a všimli jsme si, že se na mobilu špatně zobrazuje a chybí na něm aktuální ceník.\n\nPřipravili jsme nezávazný návrh nového webu: https://${slugify(name)}.vercel.app\n\nS pozdravem\nWebové stránky`;

    // Contacted leads: L1 sent, some replied.
    const replies: {
      classification: "interested" | "not_interested" | "question" | "change_request";
      text: string;
    }[] = [
      {
        classification: "interested",
        text: "Dobrý den, návrh se nám líbí. Kolik by to stálo měsíčně? Děkuji.",
      },
      {
        classification: "interested",
        text: "Zdravím, to vypadá skvěle. Můžeme se domluvit na dalším postupu?",
      },
      { classification: "question", text: "Dobrý den, je v ceně i doména a e-mailové schránky?" },
      { classification: "question", text: "Dá se do webu přidat i online rezervace termínů?" },
      {
        classification: "change_request",
        text: "Líbí se mi to, jen bych chtěla jiné barvy – spíš do zelena, a jiné fotky.",
      },
      { classification: "not_interested", text: "Děkujeme, ale web zatím měnit nechceme." },
    ];
    for (const [n, i] of contactedIdx.entries()) {
      const lead = insertedLeads[i];
      const t = await thread({ leadId: lead.id, subject: `Návrh nového webu pro ${lead.name}` });
      const sentAt = daysAgo(int(4, 35));
      const out = await email(t.id, {
        direction: "outbound",
        status: "sent",
        kind: "offer_l1",
        templateId: tpl.offer_l1.id,
        toAddress: lead.email!,
        subject: t.subject,
        bodyText: l1Body(lead.name),
        approvedAt: sentAt,
        sentAt,
        createdAt: sentAt,
      });
      const reply = replies[n];
      if (reply) {
        const receivedAt = new Date(sentAt.getTime() + int(3, 60) * 3_600_000);
        await email(t.id, {
          direction: "inbound",
          status: "received",
          fromAddress: lead.email!,
          toAddress: SENDER_ADDRESS,
          subject: `Re: ${t.subject}`,
          bodyText: reply.text,
          inReplyTo: out.messageIdHeader,
          classification: reply.classification,
          classificationSource: "ai",
          classificationConfidence: Math.round((0.7 + rand() * 0.29) * 100) / 100,
          classificationReason: "Ukázková klasifikace ze seed dat",
          receivedAt,
          readAt: n % 2 === 0 ? null : new Date(receivedAt.getTime() + 3_600_000),
          createdAt: receivedAt,
        });
        if (reply.classification === "interested") {
          await email(t.id, {
            direction: "outbound",
            status: "pending_approval",
            kind: "offer_l2",
            templateId: tpl.offer_l2.id,
            toAddress: lead.email!,
            subject: `Finální návrh webu a smlouva – ${lead.name}`,
            bodyText: `Dobrý den,\n\nděkuji za odpověď. V příloze posílám finální návrh webu a smlouvu.\n\nNavrhované předplatné: Standard za 990 Kč měsíčně.\n\nS pozdravem\nWebové stránky`,
            createdAt: daysAgo(1),
          });
        }
      }
    }

    // New leads: L1 drafts waiting for approval.
    for (const i of newIdx.slice(0, 3)) {
      const lead = insertedLeads[i];
      if (!lead.email) continue;
      const t = await thread({ leadId: lead.id, subject: `Návrh nového webu pro ${lead.name}` });
      await email(t.id, {
        direction: "outbound",
        status: "pending_approval",
        kind: "offer_l1",
        templateId: tpl.offer_l1.id,
        toAddress: lead.email,
        subject: t.subject,
        bodyText: l1Body(lead.name),
        createdAt: daysAgo(0),
      });
    }

    // Rejected leads: replied not interested; the first one unsubscribed → blacklist + a blocked email.
    const blacklisted: string[] = [];
    for (const [n, i] of rejectedIdx.entries()) {
      const lead = insertedLeads[i];
      const t = await thread({ leadId: lead.id, subject: `Návrh nového webu pro ${lead.name}` });
      const sentAt = daysAgo(int(40, 80));
      await email(t.id, {
        direction: "outbound",
        status: "sent",
        kind: "offer_l1",
        templateId: tpl.offer_l1.id,
        toAddress: lead.email!,
        subject: t.subject,
        bodyText: l1Body(lead.name),
        approvedAt: sentAt,
        sentAt,
        createdAt: sentAt,
      });
      const receivedAt = new Date(sentAt.getTime() + 86_400_000);
      await email(t.id, {
        direction: "inbound",
        status: "received",
        fromAddress: lead.email!,
        toAddress: SENDER_ADDRESS,
        subject: `Re: ${t.subject}`,
        bodyText: n === 0 ? "Nemáme zájem, prosím nekontaktujte nás." : "Děkujeme, nemáme zájem.",
        classification: "not_interested",
        classificationSource: n === 2 ? "manual" : "ai",
        classificationConfidence: n === 2 ? null : 0.96,
        receivedAt,
        readAt: new Date(receivedAt.getTime() + 3_600_000),
        createdAt: receivedAt,
      });
      if (n === 0) {
        blacklisted.push(lead.email!.toLowerCase());
        await email(t.id, {
          direction: "outbound",
          status: "blocked",
          kind: "custom",
          toAddress: lead.email!,
          subject: `Nová nabídka pro ${lead.name}`,
          bodyText: "Dobrý den, ozýváme se znovu s aktualizovanou nabídkou…",
          error: "Adresa je na blacklistu (odhlášeno).",
          createdAt: daysAgo(5),
        });
      }
    }
    await tx
      .insert(s.emailBlacklist)
      .values([
        ...blacklisted.map((e) => ({
          email: e,
          reason: "unsubscribed" as const,
          note: "Odhlášeno odkazem v e-mailu",
        })),
        { email: "info@stary-web-servis.cz", reason: "bounced", note: "Adresa neexistuje (hard bounce)" },
        { email: "objednavky@nechcireklamu.cz", reason: "manual", note: "Výslovně požádali o nezasílání" },
      ]);

    // Converted leads: full history L1 → reply → L2 → L3 linked to the client.
    for (const cs of clientSeeds.filter((c) => c.leadId)) {
      const t = await thread({
        clientId: cs.client.id,
        leadId: cs.leadId,
        subject: `Návrh nového webu pro ${cs.client.businessName}`,
      });
      const start = Math.max(20, Math.round((NOW.getTime() - cs.client.createdAt.getTime()) / DAY) + 10);
      const steps: { kind: "offer_l1" | "offer_l2" | "offer_l3"; offset: number }[] = [
        { kind: "offer_l1", offset: start },
        { kind: "offer_l2", offset: start - 4 },
        { kind: "offer_l3", offset: start - 7 },
      ];
      for (const step of steps) {
        const at = daysAgo(step.offset);
        await email(t.id, {
          direction: "outbound",
          status: "sent",
          kind: step.kind,
          templateId: tpl[step.kind].id,
          toAddress: cs.client.email!,
          subject:
            step.kind === "offer_l1"
              ? t.subject
              : `${tpl[step.kind].name.split(" – ")[1]} – ${cs.client.businessName}`,
          bodyText:
            step.kind === "offer_l1"
              ? l1Body(cs.client.businessName)
              : "Dobrý den,\n\nposílám podklady dle domluvy.\n\nS pozdravem\nWebové stránky",
          approvedAt: at,
          sentAt: at,
          createdAt: at,
        });
        if (step.kind === "offer_l1") {
          const r = new Date(at.getTime() + 20 * 3_600_000);
          await email(t.id, {
            direction: "inbound",
            status: "received",
            fromAddress: cs.client.email!,
            toAddress: SENDER_ADDRESS,
            subject: `Re: ${t.subject}`,
            bodyText: "Dobrý den, máme zájem. Pošlete prosím podrobnosti.",
            classification: "interested",
            classificationSource: "ai",
            classificationConfidence: 0.93,
            receivedAt: r,
            readAt: r,
            createdAt: r,
          });
        }
      }
    }

    // Clients with unread change requests (dashboard unread badge).
    const changeRequests = [
      "Dobrý den, prosím o úpravu otevírací doby o svátcích – 24. 12. máme zavřeno.",
      "Zdravím, mohli bychom do ceníku doplnit dvě nové položky? Posílám je v příloze.",
      "Dobrý den, prosím vyměnit fotku na úvodní stránce za novější. Děkuji!",
    ];
    for (const [n, site] of siteSeeds
      .filter((x) => x.plan === "live")
      .slice(0, 3)
      .entries()) {
      const cs = site.clientSeed;
      const t = await thread({ clientId: cs.client.id, subject: `Úprava webu ${site.website.domain}` });
      const at = daysAgo(int(0, 3), 9 + n);
      await email(t.id, {
        direction: "inbound",
        status: "received",
        fromAddress: cs.client.email!,
        toAddress: SENDER_ADDRESS,
        subject: `Úprava webu ${site.website.domain}`,
        bodyText: changeRequests[n],
        classification: "change_request",
        classificationSource: "ai",
        classificationConfidence: 0.88,
        receivedAt: at,
        createdAt: at,
      });
      if (n === 0) {
        const at2 = new Date(at.getTime() + 2 * 3_600_000);
        await email(t.id, {
          direction: "inbound",
          status: "received",
          fromAddress: cs.client.email!,
          toAddress: SENDER_ADDRESS,
          subject: `Re: Úprava webu ${site.website.domain}`,
          bodyText: "A ještě 31. 12. otevíráme až v 15:00. Díky!",
          classification: "change_request",
          classificationSource: "ai",
          classificationConfidence: 0.81,
          receivedAt: at2,
          createdAt: at2,
        });
      }
    }

    // ---- Dunning ----------------------------------------------------------
    const STEP_DAYS = [0, 3, 7] as const;
    for (const [draft, plan] of overdueAssignments) {
      const invoice = invoiceByDraft.get(draft)!;
      const client = clientSeeds.find((c) => c.client.id === invoice.clientId)!.client;
      const startDate = addDaysStr(invoice.dueDate, 1); // day 0 = first day after due date
      const [run] = await tx
        .insert(s.dunningRuns)
        .values({
          invoiceId: invoice.id,
          status: plan.runStatus,
          startedAt: strToDate(startDate, 8),
          pausedAt: plan.runStatus === "paused" ? daysAgo(1) : null,
          stoppedAt: plan.runStatus === "completed" ? daysAgo(2) : null,
        })
        .returning();
      const t = await thread({ clientId: client.id, subject: `Platba faktury ${invoice.number}` });
      const dayIndex = daysBetween(startDate, TODAY); // 0-based day of the run
      const dueSteps = STEP_DAYS.filter((d) => d <= dayIndex).length;
      for (let k = 0; k < 3; k++) {
        const stepNo = k + 1;
        const scheduled = addDaysStr(startDate, STEP_DAYS[k]);
        const isDue = k < dueSteps;
        const isLastDue = k === dueSteps - 1;
        let status: (typeof s.dunningStepStatus.enumValues)[number] = "pending";
        let emailId: string | null = null;
        const kind = `dunning_${stepNo}` as "dunning_1" | "dunning_2" | "dunning_3";
        if (isDue && plan.runStatus !== "paused") {
          const queued = isLastDue && plan.runStatus === "active";
          const at = strToDate(scheduled, 8);
          const row = await email(t.id, {
            direction: "outbound",
            status: queued ? "pending_approval" : "sent",
            kind,
            templateId: tpl[kind].id,
            toAddress: client.email!,
            subject: tpl[kind].subject.replace("{{invoiceNumber}}", invoice.number),
            bodyText: `Dobrý den,\n\nfaktura ${invoice.number} na částku ${(invoice.amountHalere / 100).toLocaleString("cs-CZ")} Kč je po splatnosti.\nVariabilní symbol: ${invoice.variableSymbol}\n\nS pozdravem\nWebové stránky`,
            approvedAt: queued ? null : at,
            sentAt: queued ? null : at,
            createdAt: at,
          });
          emailId = row.id;
          status = queued ? "queued_for_approval" : "sent";
        } else if (isDue && plan.runStatus === "paused") {
          // Paused after step 1 was sent; later due steps wait.
          if (k === 0) {
            const at = strToDate(scheduled, 8);
            const row = await email(t.id, {
              direction: "outbound",
              status: "sent",
              kind,
              templateId: tpl[kind].id,
              toAddress: client.email!,
              subject: tpl[kind].subject.replace("{{invoiceNumber}}", invoice.number),
              bodyText: `Dobrý den,\n\npřipomínám fakturu ${invoice.number}.\n\nS pozdravem\nWebové stránky`,
              approvedAt: at,
              sentAt: at,
              createdAt: at,
            });
            emailId = row.id;
            status = "sent";
          }
        }
        if (emailId) emailIdsForDunning.set(`${invoice.id}:${stepNo}`, emailId);
        await tx.insert(s.dunningSteps).values({
          runId: run.id,
          step: stepNo,
          dayOffset: STEP_DAYS[k],
          scheduledFor: strToDate(scheduled, 8),
          status,
          emailId,
          processedAt: status === "pending" ? null : strToDate(scheduled, 8),
        });
      }
    }
    if (paidLate) {
      const invoice = invoiceByDraft.get(paidLate)!;
      const startDate = addDaysStr(invoice.dueDate, 1);
      const [run] = await tx
        .insert(s.dunningRuns)
        .values({
          invoiceId: invoice.id,
          status: "stopped_paid",
          startedAt: strToDate(startDate, 8),
          stoppedAt: invoice.paidAt,
        })
        .returning();
      await tx.insert(s.dunningSteps).values(
        STEP_DAYS.map((d, k) => ({
          runId: run.id,
          step: k + 1,
          dayOffset: d,
          scheduledFor: strToDate(addDaysStr(startDate, d), 8),
          status: k === 0 ? ("sent" as const) : ("cancelled" as const),
          processedAt: strToDate(addDaysStr(startDate, k === 0 ? 0 : 3), 8),
        })),
      );
    }

    // ---- Builder ----------------------------------------------------------
    const { lead: bLead } = convertedLeads[0];
    const bSite = siteSeeds.find((x) => x.clientSeed.leadId === bLead.id)!;
    const [project] = await tx
      .insert(s.builderProjects)
      .values({
        name: `Web – ${bLead.name}`,
        leadId: bLead.id,
        websiteId: bSite.website.id,
        clientInfo: {
          businessName: bLead.name,
          category: bLead.category ?? undefined,
          contactPerson: bLead.contactPerson ?? undefined,
          email: bLead.email ?? undefined,
          phone: bLead.phone ?? undefined,
          address: bLead.address ?? undefined,
          city: bLead.city ?? undefined,
          openingHours: bLead.openingHours ?? undefined,
          services: bLead.services ?? undefined,
          socialLinks: bLead.socialLinks ?? undefined,
          currentWebsite: bLead.websiteUrl ?? undefined,
          domain: bSite.website.domain ?? undefined,
        },
        structure: {
          mode: "one-page",
          pages: ["Home"],
          sections: ["hero", "services", "gallery", "reviews", "opening-hours", "map", "contact-form"],
          extras: [],
        },
        style: {
          template: "premium",
          palette: bLead.brandColors ?? ["#111827", "#F59E0B"],
          paletteSource: bLead.brandColors ? "logo" : "manual",
          fonts: { heading: "Playfair Display", body: "Inter" },
          mood: ["modern", "elegant"],
          referenceUrls: [],
        },
        customInstructions: "Zdůraznit telefonní číslo a otevírací dobu, na mobilu tlačítko Zavolat.",
      })
      .returning();
    const bPhotos = await tx.query.leadPhotos.findMany({ where: (p, { eq }) => eq(p.leadId, bLead.id) });
    const bReviews = insertedReviews.filter((r) => r.leadId === bLead.id).sort((a, b) => b.rating - a.rating);
    await tx.insert(s.builderAssets).values([
      ...bPhotos.map((p, k) => ({
        projectId: project.id,
        kind: "photo" as const,
        source: "scraped" as const,
        url: p.url,
        leadPhotoId: p.id,
        sortOrder: k,
        isHero: k === 0,
      })),
      ...bReviews.slice(0, 3).map((r, k) => ({
        projectId: project.id,
        kind: "review" as const,
        source: "scraped" as const,
        leadReviewId: r.id,
        sortOrder: k,
        isSelected: r.rating >= 4,
      })),
    ]);

    // ---- Summary ----------------------------------------------------------
    const counts = await tx.execute<{ table: string; n: number }>(sql`
        SELECT 'leads' AS table, count(*)::int AS n FROM leads
        UNION ALL SELECT 'clients', count(*)::int FROM clients
        UNION ALL SELECT 'websites', count(*)::int FROM websites
        UNION ALL SELECT 'subscriptions', count(*)::int FROM subscriptions
        UNION ALL SELECT 'invoices', count(*)::int FROM invoices
        UNION ALL SELECT 'overdue invoices', count(*)::int FROM invoices WHERE status = 'issued' AND due_date < ${TODAY}
        UNION ALL SELECT 'subscription_events', count(*)::int FROM subscription_events
        UNION ALL SELECT 'emails', count(*)::int FROM emails
        UNION ALL SELECT 'emails pending approval', count(*)::int FROM emails WHERE status = 'pending_approval'
        UNION ALL SELECT 'dunning_runs', count(*)::int FROM dunning_runs
      `);
    return [...counts];
  });
}
