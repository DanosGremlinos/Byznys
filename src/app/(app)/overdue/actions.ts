"use server";

import { refresh } from "next/cache";
import { db } from "@/db";
import { requireAdmin } from "@/lib/auth-guard";
import { PERIOD_MONTHS } from "@/lib/billing-period";
import { setRunPaused } from "@/server/billing/dunning";
import { recordPayment } from "@/server/billing/subscriptions";
import { createJob, kickJob } from "@/server/jobs";

/** "Zkontrolovat teď": runs the daily overdue check as a background job. */
export async function checkOverdueNow() {
  await requireAdmin();
  const job = await createJob("dunning_run", { trigger: "manual" }, "Ruční kontrola plateb");
  kickJob(job.id);
  refresh();
}

export async function setRunPausedAction(runId: string, paused: boolean) {
  await requireAdmin();
  await setRunPaused(db, runId, paused);
  refresh();
}

/** Quick "Zaplaceno" for one billing period (a month or a year) at the agreed price. */
export async function quickPayAction(subscriptionId: string) {
  await requireAdmin();
  const sub = await db.query.subscriptions.findFirst({ where: (s, { eq }) => eq(s.id, subscriptionId) });
  if (!sub) return;
  await recordPayment(db, subscriptionId, {
    months: PERIOD_MONTHS[sub.billingPeriod],
    amountHalere: sub.priceHalere,
  });
  refresh();
}
