import "server-only";
import { eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { clients, leads, subscriptionEvents, subscriptionTiers, subscriptions, websites } from "@/db/schema";
import { monthlyFromYearly, PERIOD_LABELS, type BillingPeriod } from "@/lib/billing-period";
import { extendPaidUntil } from "@/lib/dates";
import { cancelDunningFor, stopDunningIfPaid } from "./dunning";

type Sub = typeof subscriptions.$inferSelect;

async function load(db: Database, id: string): Promise<Sub> {
  const sub = await db.query.subscriptions.findFirst({ where: eq(subscriptions.id, id) });
  if (!sub) throw new Error("Předplatné nenalezeno");
  return sub;
}

export type NewSubscriptionInput = {
  clientId: string;
  websiteId?: string | null;
  newWebsite?: { name: string; domain?: string | null } | null;
  tierId?: string | null;
  name: string;
  /** Monthly (default) or yearly; priceHalere is per this period. */
  billingPeriod?: BillingPeriod;
  priceHalere: number;
  features: string[];
  startedOn: string;
  paidUntil: string;
};

/** A sale: creates the subscription (and the website record if needed) and logs it in the history. */
export async function createSubscription(db: Database, input: NewSubscriptionInput): Promise<Sub> {
  const client = await db.query.clients.findFirst({ where: eq(clients.id, input.clientId) });
  if (!client) throw new Error("Klient nenalezen");
  if (input.priceHalere <= 0) throw new Error("Cena musí být kladná");
  let websiteId = input.websiteId ?? null;
  if (websiteId) {
    const web = await db.query.websites.findFirst({ where: eq(websites.id, websiteId) });
    if (!web || web.clientId !== client.id) throw new Error("Web nepatří tomuto klientovi");
    const taken = await db.query.subscriptions.findFirst({ where: eq(subscriptions.websiteId, websiteId) });
    if (taken) throw new Error("Tento web už předplatné má");
  } else {
    if (!input.newWebsite?.name) throw new Error("Vyberte web nebo zadejte nový");
    const domain = input.newWebsite.domain?.trim() || null;
    const [web] = await db
      .insert(websites)
      .values({
        clientId: client.id,
        name: input.newWebsite.name.trim(),
        domain,
        status: "in_progress",
        liveUrl: domain ? `https://${domain}` : null,
      })
      .returning();
    websiteId = web.id;
  }
  const [sub] = await db
    .insert(subscriptions)
    .values({
      clientId: client.id,
      websiteId,
      tierId: input.tierId ?? null,
      name: input.name,
      billingPeriod: input.billingPeriod ?? "monthly",
      priceHalere: input.priceHalere,
      features: input.features,
      status: "active",
      startedOn: input.startedOn,
      paidUntil: input.paidUntil,
    })
    .returning();
  await db.insert(subscriptionEvents).values({
    subscriptionId: sub.id,
    clientId: client.id,
    type: "created",
    toTierId: input.tierId ?? null,
    toPriceHalere: input.priceHalere,
    amountHalere: input.priceHalere,
    note: `Nové předplatné: ${input.name}${input.billingPeriod === "yearly" ? " (ročně)" : ""}`,
  });
  if (client.leadId) await db.update(leads).set({ status: "converted" }).where(eq(leads.id, client.leadId));
  return sub;
}

function paymentNote(months: number): string | null {
  if (months === 1) return null;
  if (months === 12) return "Platba na rok";
  return `Platba za ${months} ${months <= 4 ? "měsíce" : "měsíců"}`;
}

/** Records a payment received outside the app; moves paid_until forward and stops covered reminders. */
export async function recordPayment(
  db: Database,
  subscriptionId: string,
  input: { months: number; amountHalere: number; note?: string | null; paidAt?: Date },
) {
  if (!Number.isInteger(input.months) || input.months < 1 || input.months > 36)
    throw new Error("Počet měsíců 1–36");
  if (input.amountHalere <= 0) throw new Error("Částka musí být kladná");
  const sub = await load(db, subscriptionId);
  if (sub.status === "cancelled") throw new Error("Zrušené předplatné nelze platit");
  const paidUntil = extendPaidUntil(sub.paidUntil, input.months);
  await db.update(subscriptions).set({ paidUntil }).where(eq(subscriptions.id, sub.id));
  await db.insert(subscriptionEvents).values({
    subscriptionId: sub.id,
    clientId: sub.clientId,
    type: "payment_received",
    amountHalere: input.amountHalere,
    paidUntil,
    note: input.note || paymentNote(input.months),
    occurredAt: input.paidAt ?? new Date(),
  });
  const stopped = await stopDunningIfPaid(db, sub.id);
  return { paidUntil, stoppedReminders: stopped };
}

/** Switches package and/or price; logged as upgrade or downgrade by price. */
export async function changePackage(
  db: Database,
  subscriptionId: string,
  input: {
    tierId: string | null;
    name: string;
    priceHalere: number;
    features: string[];
    billingPeriod?: BillingPeriod;
  },
) {
  const sub = await load(db, subscriptionId);
  if (sub.status === "cancelled") throw new Error("Zrušené předplatné nelze měnit");
  if (input.priceHalere <= 0) throw new Error("Cena musí být kladná");
  const period = input.billingPeriod ?? sub.billingPeriod;
  // Compare the package's monthly list price (yearly price ÷ 10), so switching to the cheaper yearly
  // payment alone is not a "downgrade"; only a cheaper package is.
  const listMonthly = (price: number, p: BillingPeriod) => (p === "yearly" ? monthlyFromYearly(price) : price);
  const type =
    listMonthly(input.priceHalere, period) < listMonthly(sub.priceHalere, sub.billingPeriod)
      ? ("downgraded" as const)
      : ("upgraded" as const);
  await db
    .update(subscriptions)
    .set({
      tierId: input.tierId,
      name: input.name,
      billingPeriod: period,
      priceHalere: input.priceHalere,
      features: input.features,
    })
    .where(eq(subscriptions.id, sub.id));
  await db.insert(subscriptionEvents).values({
    subscriptionId: sub.id,
    clientId: sub.clientId,
    type,
    fromTierId: sub.tierId,
    toTierId: input.tierId,
    fromPriceHalere: sub.priceHalere,
    toPriceHalere: input.priceHalere,
    note: [
      sub.name !== input.name ? `${sub.name} → ${input.name}` : null,
      period !== sub.billingPeriod
        ? `platba: ${PERIOD_LABELS[sub.billingPeriod].toLowerCase()} → ${PERIOD_LABELS[period].toLowerCase()}`
        : null,
    ]
      .filter(Boolean)
      .join(", ") || "Úprava balíčku",
  });
}

export async function setSubscriptionPaused(db: Database, subscriptionId: string, paused: boolean) {
  const sub = await load(db, subscriptionId);
  if (paused ? sub.status !== "active" : sub.status !== "paused") return;
  await db
    .update(subscriptions)
    .set({ status: paused ? "paused" : "active" })
    .where(eq(subscriptions.id, sub.id));
  await db.insert(subscriptionEvents).values({
    subscriptionId: sub.id,
    clientId: sub.clientId,
    type: paused ? "paused" : "resumed",
  });
  if (paused) await cancelDunningFor(db, sub.id);
}

export async function cancelSubscription(db: Database, subscriptionId: string, reason: string | null) {
  const sub = await load(db, subscriptionId);
  if (sub.status === "cancelled") return;
  await db
    .update(subscriptions)
    .set({ status: "cancelled", cancelledAt: new Date(), cancelReason: reason })
    .where(eq(subscriptions.id, sub.id));
  await db.insert(subscriptionEvents).values({
    subscriptionId: sub.id,
    clientId: sub.clientId,
    type: "cancelled",
    fromTierId: sub.tierId,
    note: reason,
  });
  await cancelDunningFor(db, sub.id);
}

/** Manual website suspension / reactivation (e.g. after the final reminder). */
export async function setWebsiteSuspended(db: Database, websiteId: string, suspended: boolean) {
  const web = await db.query.websites.findFirst({ where: eq(websites.id, websiteId) });
  if (!web) throw new Error("Web nenalezen");
  if (suspended ? web.status === "suspended" : web.status !== "suspended") return;
  await db
    .update(websites)
    .set({ status: suspended ? "suspended" : "live" })
    .where(eq(websites.id, websiteId));
  const sub = await db.query.subscriptions.findFirst({ where: eq(subscriptions.websiteId, websiteId) });
  if (sub) {
    await db.insert(subscriptionEvents).values({
      subscriptionId: sub.id,
      clientId: sub.clientId,
      type: suspended ? "website_suspended" : "website_reactivated",
      note: suspended ? "Web pozastaven ručně" : "Web znovu spuštěn",
    });
  }
}

// ---------------------------------------------------------------------------
// Package contents ("Obsah balíčků", table subscription_tiers). Prices come from the calculator or are
// typed per client; the legacy monthly_price_halere column is no longer edited (new rows get 0).
// ---------------------------------------------------------------------------

export async function upsertTier(
  db: Database,
  id: string | null,
  input: {
    name: string;
    description: string | null;
    features: string[];
    isActive: boolean;
    sortOrder: number;
  },
) {
  if (id) await db.update(subscriptionTiers).set(input).where(eq(subscriptionTiers.id, id));
  else await db.insert(subscriptionTiers).values({ ...input, monthlyPriceHalere: 0 });
}

export function defaultPaidUntil(startedOn: string): string {
  // Nothing paid yet: the first payment is due on the start date.
  const [y, m, d] = startedOn.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}
