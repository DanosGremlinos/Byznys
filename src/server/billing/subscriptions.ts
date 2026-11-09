import "server-only";
import { and, eq, lte } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  clients,
  dunningRuns,
  dunningSteps,
  emails,
  leads,
  subscriptionEvents,
  subscriptionTiers,
  subscriptions,
  websites,
} from "@/db/schema";
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
    note: `Nové předplatné: ${input.name}`,
  });
  if (client.leadId) await db.update(leads).set({ status: "converted" }).where(eq(leads.id, client.leadId));
  return sub;
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
    note: input.note || (input.months > 1 ? `Platba za ${input.months} měsíce` : null),
    occurredAt: input.paidAt ?? new Date(),
  });
  const stopped = await stopDunningIfPaid(db, sub.id);
  return { paidUntil, stoppedReminders: stopped };
}

/** Switches package and/or price; logged as upgrade or downgrade by price. */
export async function changePackage(
  db: Database,
  subscriptionId: string,
  input: { tierId: string | null; name: string; priceHalere: number; features: string[] },
) {
  const sub = await load(db, subscriptionId);
  if (sub.status === "cancelled") throw new Error("Zrušené předplatné nelze měnit");
  if (input.priceHalere <= 0) throw new Error("Cena musí být kladná");
  const type = input.priceHalere < sub.priceHalere ? ("downgraded" as const) : ("upgraded" as const);
  await db
    .update(subscriptions)
    .set({ tierId: input.tierId, name: input.name, priceHalere: input.priceHalere, features: input.features })
    .where(eq(subscriptions.id, sub.id));
  await db.insert(subscriptionEvents).values({
    subscriptionId: sub.id,
    clientId: sub.clientId,
    type,
    fromTierId: sub.tierId,
    toTierId: input.tierId,
    fromPriceHalere: sub.priceHalere,
    toPriceHalere: input.priceHalere,
    note: sub.name !== input.name ? `${sub.name} → ${input.name}` : "Úprava balíčku",
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

/** Days the final reminder gives the client to pay before the site may be suspended (see its text). */
export const SUSPENSION_NOTICE_DAYS = 3;

/**
 * Suspending the site of a paying client is a contractual sanction: it is allowed only after the
 * written final notice that warned about it (reminder 3) was sent and its deadline passed. Without
 * that, suspension could itself be a breach of contract. Cancelled subscriptions are not restricted.
 */
export async function suspensionBlockReason(
  db: Database,
  websiteId: string,
  now: Date = new Date(),
): Promise<string | null> {
  const sub = await db.query.subscriptions.findFirst({ where: eq(subscriptions.websiteId, websiteId) });
  if (!sub || sub.status === "cancelled") return null;
  const deadline = new Date(now.getTime() - SUSPENSION_NOTICE_DAYS * 86_400_000);
  const [notice] = await db
    .select({ id: emails.id })
    .from(dunningSteps)
    .innerJoin(dunningRuns, eq(dunningRuns.id, dunningSteps.runId))
    .innerJoin(emails, eq(emails.id, dunningSteps.emailId))
    .where(
      and(
        eq(dunningRuns.subscriptionId, sub.id),
        eq(dunningSteps.step, 3),
        eq(emails.status, "sent"),
        lte(emails.sentAt, deadline),
      ),
    )
    .limit(1);
  if (notice) return null;
  return `Web lze pozastavit až ${SUSPENSION_NOTICE_DAYS} dny po odeslání poslední výzvy (upomínka 3), která na pozastavení upozorňuje. Jinak hrozí porušení smlouvy z vaší strany.`;
}

/**
 * Manual website suspension / reactivation (after the final reminder's deadline). Returns an error
 * message when suspension is not allowed yet, otherwise null.
 */
export async function setWebsiteSuspended(
  db: Database,
  websiteId: string,
  suspended: boolean,
): Promise<string | null> {
  const web = await db.query.websites.findFirst({ where: eq(websites.id, websiteId) });
  if (!web) throw new Error("Web nenalezen");
  if (suspended ? web.status === "suspended" : web.status !== "suspended") return null;
  if (suspended) {
    const blocked = await suspensionBlockReason(db, websiteId);
    if (blocked) return blocked;
  }
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
  return null;
}

// ---------------------------------------------------------------------------
// Package templates (tiers)
// ---------------------------------------------------------------------------

export async function upsertTier(
  db: Database,
  id: string | null,
  input: {
    name: string;
    description: string | null;
    monthlyPriceHalere: number;
    features: string[];
    isActive: boolean;
    sortOrder: number;
  },
) {
  if (id) await db.update(subscriptionTiers).set(input).where(eq(subscriptionTiers.id, id));
  else await db.insert(subscriptionTiers).values(input);
}

export function defaultPaidUntil(startedOn: string): string {
  // Nothing paid yet: the first payment is due on the start date.
  const [y, m, d] = startedOn.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}
