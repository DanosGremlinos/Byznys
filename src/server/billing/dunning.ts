import "server-only";
import { and, asc, desc, eq, inArray, lt, or } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  clients,
  dunningRuns,
  dunningSteps,
  emailTemplates,
  emailThreads,
  emails,
  subscriptions,
  websites,
} from "@/db/schema";
import { addDays, daysOverdue } from "@/lib/dates";
import { formatCzk, formatDate, pragueToday } from "@/lib/format";
import { normalizeEmail, renderTemplate } from "@/server/email/render";
import { senderFrom, senderName } from "@/server/messaging/compose";

/** Day offsets of the three reminders, counted from the first unpaid day (paid_until + 1). */
export const DUNNING_STEPS = [
  { step: 1, dayOffset: 0 },
  { step: 2, dayOffset: 3 },
  { step: 3, dayOffset: 7 },
] as const;

/** 08:00 Prague on the given calendar date (approximation: CET/CEST resolved via Intl). */
function pragueMorning(date: string): Date {
  const utcGuess = new Date(`${date}T07:00:00Z`);
  const hourInPrague = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Prague", hour: "2-digit", hour12: false }).format(
      utcGuess,
    ),
  );
  return new Date(utcGuess.getTime() - (hourInPrague - 8) * 3_600_000);
}

export type DunningSummary = {
  started: number;
  queued: number;
  skipped: number;
  stoppedPaid: number;
  completed: number;
  cancelled: number;
};

/** Withdraws pending/queued steps of a run and rejects their unsent drafts. */
async function closeRun(db: Database, runId: string, status: "stopped_paid" | "cancelled") {
  const open = await db
    .select()
    .from(dunningSteps)
    .where(
      and(eq(dunningSteps.runId, runId), inArray(dunningSteps.status, ["pending", "queued_for_approval"])),
    );
  const draftIds = open.map((s) => s.emailId).filter((x): x is string => Boolean(x));
  if (draftIds.length) {
    await db
      .update(emails)
      .set({
        status: "rejected",
        error: status === "stopped_paid" ? "Zaplaceno – upomínka stažena." : "Upomínky zrušeny.",
      })
      .where(
        and(
          inArray(emails.id, draftIds),
          inArray(emails.status, ["pending_approval", "approved", "failed", "blocked"]),
        ),
      );
  }
  await db
    .update(dunningSteps)
    .set({ status: "cancelled", processedAt: new Date() })
    .where(
      and(eq(dunningSteps.runId, runId), inArray(dunningSteps.status, ["pending", "queued_for_approval"])),
    );
  await db
    .update(dunningRuns)
    .set({ status, stoppedAt: new Date() })
    .where(and(eq(dunningRuns.id, runId), inArray(dunningRuns.status, ["active", "paused"])));
}

/** Called right after a payment is recorded: stops reminders that the payment covers. */
export async function stopDunningIfPaid(db: Database, subscriptionId: string): Promise<number> {
  const sub = await db.query.subscriptions.findFirst({ where: eq(subscriptions.id, subscriptionId) });
  if (!sub) return 0;
  const runs = await db
    .select()
    .from(dunningRuns)
    .where(
      and(
        eq(dunningRuns.subscriptionId, subscriptionId),
        inArray(dunningRuns.status, ["active", "paused"]),
        lt(dunningRuns.missedPaidUntil, sub.paidUntil),
      ),
    );
  for (const run of runs) await closeRun(db, run.id, "stopped_paid");
  return runs.length;
}

export async function cancelDunningFor(db: Database, subscriptionId: string) {
  const runs = await db
    .select()
    .from(dunningRuns)
    .where(
      and(eq(dunningRuns.subscriptionId, subscriptionId), inArray(dunningRuns.status, ["active", "paused"])),
    );
  for (const run of runs) await closeRun(db, run.id, "cancelled");
}

async function createReminderDraft(
  db: Database,
  run: typeof dunningRuns.$inferSelect,
  step: number,
  today: string,
): Promise<string | null> {
  const sub = await db.query.subscriptions.findFirst({ where: eq(subscriptions.id, run.subscriptionId) });
  if (!sub) return null;
  const client = await db.query.clients.findFirst({ where: eq(clients.id, sub.clientId) });
  if (!client?.email) return null;
  const website = await db.query.websites.findFirst({ where: eq(websites.id, sub.websiteId) });
  const kind = `dunning_${step}` as "dunning_1" | "dunning_2" | "dunning_3";
  const template =
    (await db.query.emailTemplates.findFirst({ where: eq(emailTemplates.key, `${kind}_default`) })) ??
    (await db.query.emailTemplates.findFirst({
      where: eq(emailTemplates.kind, kind),
      orderBy: asc(emailTemplates.createdAt),
    }));
  if (!template) return null;
  const dueDate = addDays(run.missedPaidUntil, 1);
  const vars = {
    businessName: client.businessName,
    contactGreeting: "",
    amount: formatCzk(run.amountHalere).replace(/\s/g, " "),
    dueDate: formatDate(dueDate),
    daysOverdue: String(daysOverdue(run.missedPaidUntil, today)),
    websiteDomain: website?.domain ?? website?.name ?? "",
    senderName: senderName(),
  };
  const subject = renderTemplate(template.subject, vars);
  let thread = await db.query.emailThreads.findFirst({
    where: and(eq(emailThreads.clientId, client.id)),
    orderBy: desc(emailThreads.lastMessageAt),
  });
  const paymentThreadSubject = `Platba za web ${vars.websiteDomain}`;
  if (!thread || thread.subject !== paymentThreadSubject) {
    thread =
      (await db.query.emailThreads.findFirst({
        where: and(eq(emailThreads.clientId, client.id), eq(emailThreads.subject, paymentThreadSubject)),
      })) ??
      (
        await db
          .insert(emailThreads)
          .values({ clientId: client.id, subject: paymentThreadSubject })
          .returning()
      )[0];
  }
  const [email] = await db
    .insert(emails)
    .values({
      threadId: thread.id,
      direction: "outbound",
      status: "pending_approval",
      kind,
      templateId: template.id,
      fromAddress: senderFrom(),
      toAddress: normalizeEmail(client.email),
      subject,
      bodyText: renderTemplate(template.body, vars),
    })
    .returning();
  return email.id;
}

/**
 * Daily dunning check (cron or "Zkontrolovat teď"). Starts sequences for newly overdue subscriptions,
 * puts the reminder that is due into the APPROVAL QUEUE (never sends), stops paid or cancelled runs.
 * When several steps are due at once (e.g. the check didn't run for days), only the latest is queued.
 */
export async function processDunning(db: Database, today: string = pragueToday()): Promise<DunningSummary> {
  const summary: DunningSummary = {
    started: 0,
    queued: 0,
    skipped: 0,
    stoppedPaid: 0,
    completed: 0,
    cancelled: 0,
  };

  // 1. Start a run for each active subscription whose paid-until date has passed.
  const overdue = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.status, "active"), lt(subscriptions.paidUntil, today)));
  for (const sub of overdue) {
    const [run] = await db
      .insert(dunningRuns)
      .values({
        subscriptionId: sub.id,
        missedPaidUntil: sub.paidUntil,
        amountHalere: sub.priceHalere,
        startedAt: pragueMorning(addDays(sub.paidUntil, 1)),
      })
      .onConflictDoNothing()
      .returning();
    if (run) {
      summary.started++;
      await db.insert(dunningSteps).values(
        DUNNING_STEPS.map((s) => ({
          runId: run.id,
          step: s.step,
          dayOffset: s.dayOffset,
          scheduledFor: pragueMorning(addDays(sub.paidUntil, 1 + s.dayOffset)),
        })),
      );
    }
  }

  // 2. Close runs that were paid, or whose subscription is no longer active.
  const openRuns = await db
    .select({ run: dunningRuns, sub: subscriptions })
    .from(dunningRuns)
    .innerJoin(subscriptions, eq(subscriptions.id, dunningRuns.subscriptionId))
    .where(inArray(dunningRuns.status, ["active", "paused"]));
  for (const { run, sub } of openRuns) {
    if (sub.paidUntil > run.missedPaidUntil) {
      await closeRun(db, run.id, "stopped_paid");
      summary.stoppedPaid++;
    } else if (sub.status !== "active") {
      await closeRun(db, run.id, "cancelled");
      summary.cancelled++;
    }
  }

  // 3. Queue the step that is due on active runs.
  const active = await db.query.dunningRuns.findMany({
    where: eq(dunningRuns.status, "active"),
    with: { steps: { orderBy: asc(dunningSteps.step) } },
  });
  for (const run of active) {
    const dayIndex = daysOverdue(run.missedPaidUntil, today) - 1; // 0 on the first unpaid day
    const due = run.steps.filter((s) => s.status === "pending" && s.dayOffset <= dayIndex);
    if (due.length) {
      const latest = due[due.length - 1];
      for (const s of due.slice(0, -1)) {
        await db
          .update(dunningSteps)
          .set({ status: "skipped", processedAt: new Date() })
          .where(eq(dunningSteps.id, s.id));
        summary.skipped++;
      }
      const emailId = await createReminderDraft(db, run, latest.step, today);
      await db
        .update(dunningSteps)
        .set({ status: emailId ? "queued_for_approval" : "skipped", emailId, processedAt: new Date() })
        .where(eq(dunningSteps.id, latest.id));
      if (emailId) summary.queued++;
      else summary.skipped++;
    }
    // A run is complete once no step is waiting any more.
    const fresh = await db.select().from(dunningSteps).where(eq(dunningSteps.runId, run.id));
    if (fresh.every((s) => s.status === "sent" || s.status === "skipped" || s.status === "cancelled")) {
      await db
        .update(dunningRuns)
        .set({ status: "completed", stoppedAt: new Date() })
        .where(eq(dunningRuns.id, run.id));
      summary.completed++;
    }
  }
  return summary;
}

/** Keeps dunning steps in sync with what happens to their e-mail in the approval queue. */
export async function syncDunningStepForEmail(db: Database, emailId: string, outcome: "sent" | "rejected") {
  await db
    .update(dunningSteps)
    .set(
      outcome === "sent"
        ? { status: "sent", processedAt: new Date() }
        : { status: "cancelled", processedAt: new Date() },
    )
    .where(
      and(
        eq(dunningSteps.emailId, emailId),
        or(eq(dunningSteps.status, "queued_for_approval"), eq(dunningSteps.status, "pending")),
      ),
    );
}

export async function setRunPaused(db: Database, runId: string, paused: boolean) {
  await db
    .update(dunningRuns)
    .set(paused ? { status: "paused", pausedAt: new Date() } : { status: "active", pausedAt: null })
    .where(and(eq(dunningRuns.id, runId), eq(dunningRuns.status, paused ? "active" : "paused")));
}
