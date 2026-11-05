// Where a job (zakázka = website) is in the sales pipeline. Pure; derived from existing data.

export type JobStageGroup = "active" | "open" | "closed";

export type JobStage = {
  key:
    | "draft"
    | "l1_sent"
    | "l2_sent"
    | "budget_asked"
    | "packages_ready"
    | "l3_sent"
    | "active"
    | "overdue"
    | "paused"
    | "suspended"
    | "cancelled";
  label: string;
  group: JobStageGroup;
};

export const JOB_GROUP_LABELS: Record<JobStageGroup, string> = {
  active: "Aktivní – s balíčkem",
  open: "Rozjednané – bez balíčku",
  closed: "Ukončené",
};

export const JOB_STAGE_TONE: Record<JobStage["key"], string> = {
  draft: "bg-slate-100 text-slate-700",
  l1_sent: "bg-sky-100 text-sky-800",
  l2_sent: "bg-sky-100 text-sky-800",
  budget_asked: "bg-violet-100 text-violet-800",
  packages_ready: "bg-violet-100 text-violet-800",
  l3_sent: "bg-amber-100 text-amber-800",
  active: "bg-emerald-100 text-emerald-800",
  overdue: "bg-red-100 text-red-800",
  paused: "bg-slate-200 text-slate-700",
  suspended: "bg-red-100 text-red-800",
  cancelled: "bg-slate-200 text-slate-600",
};

export type JobStageInput = {
  websiteStatus: string;
  subscription: { status: string; paidUntil: string } | null;
  /** Kinds of offer emails already sent to this client (offer_l1, offer_l2, offer_budget, offer_l3). */
  sentKinds: readonly string[];
  hasPackageOffer: boolean;
  /** YYYY-MM-DD in Europe/Prague. */
  today: string;
};

export function jobStage(i: JobStageInput): JobStage {
  const sub = i.subscription;
  if (sub) {
    if (sub.status === "cancelled") return { key: "cancelled", label: "Předplatné zrušeno", group: "closed" };
    if (i.websiteStatus === "suspended") return { key: "suspended", label: "Web pozastaven", group: "active" };
    if (sub.status === "paused") return { key: "paused", label: "Předplatné pozastaveno", group: "active" };
    if (sub.paidUntil < i.today) return { key: "overdue", label: "Aktivní · po splatnosti", group: "active" };
    return { key: "active", label: "Aktivní", group: "active" };
  }
  if (i.websiteStatus === "cancelled") return { key: "cancelled", label: "Zrušeno", group: "closed" };
  const sent = new Set(i.sentKinds);
  if (sent.has("offer_l3")) return { key: "l3_sent", label: "Balíčky nabídnuty (L3)", group: "open" };
  if (i.hasPackageOffer) return { key: "packages_ready", label: "Balíčky spočítány", group: "open" };
  if (sent.has("offer_budget")) return { key: "budget_asked", label: "Čeká na rozpočet", group: "open" };
  if (sent.has("offer_l2")) return { key: "l2_sent", label: "Smlouva odeslána (L2)", group: "open" };
  if (sent.has("offer_l1")) return { key: "l1_sent", label: "Nabídka odeslána (L1)", group: "open" };
  return { key: "draft", label: "Rozpracováno", group: "open" };
}

export type SentOfferKind = { kind: string; lastSentAt: Date };

/**
 * Offer emails are stored per client, not per job. When a client has more than one job, only emails sent
 * after this job was created count for it (older ones belong to the earlier deal).
 */
export function relevantSentKinds(
  sent: readonly SentOfferKind[],
  job: { createdAt: Date; clientHasOtherJobs: boolean },
): string[] {
  return sent
    .filter((s) => !job.clientHasOtherJobs || s.lastSentAt.getTime() >= job.createdAt.getTime())
    .map((s) => s.kind);
}
