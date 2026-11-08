// Integration: dunning engine + subscription changes. Requires TEST_DATABASE_URL.
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/db/client";
import {
  clients,
  dunningRuns,
  dunningSteps,
  emails,
  leads,
  subscriptionEvents,
  subscriptions,
  websites,
} from "@/db/schema";
import { addDays } from "@/lib/dates";
import { pragueToday } from "@/lib/format";
import { processDunning, setRunPaused, syncDunningStepForEmail } from "@/server/billing/dunning";
import {
  changePackage,
  createSubscription,
  recordPayment,
  setWebsiteSuspended,
} from "@/server/billing/subscriptions";
import type { EmailProvider, OutgoingEmail } from "@/server/email/provider";
import { sendApprovedEmail } from "@/server/email/send";
import { setupTestDb } from "./helpers/db";

const url = process.env.TEST_DATABASE_URL;
const TODAY = pragueToday();

class FakeProvider implements EmailProvider {
  readonly name = "log" as const;
  sent: OutgoingEmail[] = [];
  async send(email: OutgoingEmail) {
    this.sent.push(email);
    return { providerMessageId: `fake-${this.sent.length}`, delivered: false };
  }
}

describe.skipIf(!url)("billing & dunning (DB)", () => {
  let db: Database;
  let clientId: string;

  async function newSub(paidUntil: string, name = "Test web") {
    return createSubscription(db, {
      clientId,
      newWebsite: { name, domain: `${name.toLowerCase().replace(/\s/g, "-")}.cz` },
      tierId: null,
      name: "Standard",
      priceHalere: 99000,
      features: ["Hosting"],
      startedOn: addDays(paidUntil, -60),
      paidUntil,
    });
  }
  const stepsOf = async (subId: string) => {
    const run = await db.query.dunningRuns.findFirst({ where: eq(dunningRuns.subscriptionId, subId) });
    const steps = run
      ? await db.select().from(dunningSteps).where(eq(dunningSteps.runId, run.id)).orderBy(dunningSteps.step)
      : [];
    return { run, steps };
  };

  beforeAll(async () => {
    db = await setupTestDb(url!);
    const [c] = await db
      .insert(clients)
      .values({ businessName: "Testovací klient", email: "platby@klient.test" })
      .returning();
    clientId = c.id;
  });
  afterAll(async () => {
    await db?.$close();
  });

  it("is idempotent on the seeded data (no duplicate runs or reminders)", async () => {
    await processDunning(db, TODAY);
    const before = await db.select().from(emails);
    const s = await processDunning(db, TODAY);
    expect(s.started).toBe(0);
    expect(s.queued).toBe(0);
    expect((await db.select().from(emails)).length).toBe(before.length);
  });

  it("starts a run on the first unpaid day and queues reminders for approval at day 0, 3 and 7", async () => {
    const provider = new FakeProvider();
    const sub = await newSub(addDays(TODAY, -1), "Den nula");
    const s = await processDunning(db, TODAY);
    expect(s.started).toBeGreaterThanOrEqual(1);
    const { run } = await stepsOf(sub.id);
    let { steps } = await stepsOf(sub.id);
    expect(run?.status).toBe("active");
    expect(steps.map((x) => x.status)).toEqual(["queued_for_approval", "pending", "pending"]);
    const draft = await db.query.emails.findFirst({ where: eq(emails.id, steps[0].emailId!) });
    expect(draft?.status).toBe("pending_approval");
    expect(draft?.kind).toBe("dunning_1");
    expect(draft?.bodyText).toContain("990 Kč");
    expect(draft?.bodyText).toContain("den-nula.cz");
    expect(provider.sent).toHaveLength(0); // the engine never sends

    await processDunning(db, addDays(TODAY, 2)); // day index 2: nothing new
    ({ steps } = await stepsOf(sub.id));
    expect(steps[1].status).toBe("pending");
    await processDunning(db, addDays(TODAY, 3)); // day 3
    ({ steps } = await stepsOf(sub.id));
    expect(steps[1].status).toBe("queued_for_approval");

    // Owner approves step 2 → step marked sent.
    const r = await sendApprovedEmail(db, provider, steps[1].emailId!);
    expect(r.ok).toBe(true);
    ({ steps } = await stepsOf(sub.id));
    expect(steps[1].status).toBe("sent");

    await processDunning(db, addDays(TODAY, 7)); // day 7
    ({ steps } = await stepsOf(sub.id));
    expect(steps[2].status).toBe("queued_for_approval");
    const final = await db.query.emails.findFirst({ where: eq(emails.id, steps[2].emailId!) });
    expect(final?.kind).toBe("dunning_3");
  });

  it("allows suspending the website only after the final notice's deadline", async () => {
    const provider = new FakeProvider();
    const sub = await newSub(addDays(TODAY, -10), "Pozastaveni");
    await processDunning(db, TODAY);
    const { steps } = await stepsOf(sub.id);
    expect(steps[2].status).toBe("queued_for_approval");
    const early = await setWebsiteSuspended(db, sub.websiteId, true);
    expect(early).toContain("poslední výzvy");
    expect((await db.query.websites.findFirst({ where: eq(websites.id, sub.websiteId) }))?.status).not.toBe(
      "suspended",
    );
    expect((await sendApprovedEmail(db, provider, steps[2].emailId!)).ok).toBe(true);
    expect(await setWebsiteSuspended(db, sub.websiteId, true)).toContain("poslední výzvy"); // deadline not over
    await db
      .update(emails)
      .set({ sentAt: new Date(Date.now() - 4 * 86_400_000) })
      .where(eq(emails.id, steps[2].emailId!));
    expect(await setWebsiteSuspended(db, sub.websiteId, true)).toBeNull();
    expect((await db.query.websites.findFirst({ where: eq(websites.id, sub.websiteId) }))?.status).toBe(
      "suspended",
    );
  });

  it("queues only the latest due step when the check catches up", async () => {
    const sub = await newSub(addDays(TODAY, -10), "Dohanime");
    await processDunning(db, TODAY);
    const { steps } = await stepsOf(sub.id);
    expect(steps.map((x) => x.status)).toEqual(["skipped", "skipped", "queued_for_approval"]);
  });

  it("does nothing for a paused run, continues after resume", async () => {
    const sub = await newSub(addDays(TODAY, -1), "Pauza");
    await processDunning(db, TODAY);
    const { run } = await stepsOf(sub.id);
    await setRunPaused(db, run!.id, true);
    await processDunning(db, addDays(TODAY, 4));
    let { steps } = await stepsOf(sub.id);
    expect(steps[1].status).toBe("pending");
    await setRunPaused(db, run!.id, false);
    await processDunning(db, addDays(TODAY, 4));
    ({ steps } = await stepsOf(sub.id));
    expect(steps[1].status).toBe("queued_for_approval");
  });

  it("stops immediately when the payment is recorded and withdraws queued reminders", async () => {
    const sub = await newSub(addDays(TODAY, -4), "Zaplati");
    await processDunning(db, TODAY);
    let { steps } = await stepsOf(sub.id);
    const queuedEmail = steps.find((x) => x.status === "queued_for_approval")!.emailId!;
    const r = await recordPayment(db, sub.id, { months: 1, amountHalere: 99000 });
    expect(r.paidUntil > TODAY).toBe(true);
    expect(r.stoppedReminders).toBe(1);
    const { run } = await stepsOf(sub.id);
    expect(run?.status).toBe("stopped_paid");
    ({ steps } = await stepsOf(sub.id));
    expect(
      steps.every((x) => x.status === "cancelled" || x.status === "skipped" || x.status === "sent"),
    ).toBe(true);
    const withdrawn = await db.query.emails.findFirst({ where: eq(emails.id, queuedEmail) });
    expect(withdrawn?.status).toBe("rejected");
    const ev = await db.query.subscriptionEvents.findFirst({
      where: and(
        eq(subscriptionEvents.subscriptionId, sub.id),
        eq(subscriptionEvents.type, "payment_received"),
      ),
    });
    expect(ev?.amountHalere).toBe(99000);
    expect(ev?.paidUntil).toBe(r.paidUntil);
  });

  it("rejecting a reminder in the queue cancels its step", async () => {
    const sub = await newSub(addDays(TODAY, -1), "Zamitnuti");
    await processDunning(db, TODAY);
    const { steps } = await stepsOf(sub.id);
    await syncDunningStepForEmail(db, steps[0].emailId!, "rejected");
    const after = await stepsOf(sub.id);
    expect(after.steps[0].status).toBe("cancelled");
  });

  it("logs package changes and converts the lead on a new subscription", async () => {
    const [lead] = await db.insert(leads).values({ name: "Lead k převodu", status: "contacted" }).returning();
    const [c] = await db.insert(clients).values({ businessName: "Z leadu", leadId: lead.id }).returning();
    const sub = await createSubscription(db, {
      clientId: c.id,
      newWebsite: { name: "Z leadu web" },
      name: "Premium",
      priceHalere: 199000,
      features: [],
      startedOn: TODAY,
      paidUntil: addDays(TODAY, -1),
    });
    expect((await db.query.leads.findFirst({ where: eq(leads.id, lead.id) }))?.status).toBe("converted");
    const web = await db.query.websites.findFirst({ where: eq(websites.id, sub.websiteId) });
    expect(web?.status).toBe("in_progress");
    await changePackage(db, sub.id, {
      tierId: null,
      name: "Základ",
      priceHalere: 49000,
      features: ["Hosting"],
    });
    const ev = await db.query.subscriptionEvents.findFirst({
      where: and(eq(subscriptionEvents.subscriptionId, sub.id), eq(subscriptionEvents.type, "downgraded")),
    });
    expect(ev?.fromPriceHalere).toBe(199000);
    expect(ev?.toPriceHalere).toBe(49000);
    const updated = await db.query.subscriptions.findFirst({ where: eq(subscriptions.id, sub.id) });
    expect(updated?.name).toBe("Základ");
  });
});
