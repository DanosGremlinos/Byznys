import { describe, expect, it } from "vitest";
import { jobStage, relevantSentKinds, type JobStageInput } from "@/lib/job-stage";

const base: JobStageInput = {
  websiteStatus: "in_progress",
  subscription: null,
  sentKinds: [],
  hasPackageOffer: false,
  today: "2026-11-05",
};
const key = (patch: Partial<JobStageInput>) => jobStage({ ...base, ...patch }).key;

describe("jobStage", () => {
  it("follows the sales pipeline until a subscription exists", () => {
    expect(key({})).toBe("draft");
    expect(key({ sentKinds: ["offer_l1"] })).toBe("l1_sent");
    expect(key({ sentKinds: ["offer_l1", "offer_l2"] })).toBe("l2_sent");
    expect(key({ sentKinds: ["offer_l2", "offer_budget"] })).toBe("budget_asked");
    expect(key({ sentKinds: ["offer_budget"], hasPackageOffer: true })).toBe("packages_ready");
    expect(key({ sentKinds: ["offer_l3"], hasPackageOffer: true })).toBe("l3_sent");
    expect(jobStage({ ...base, sentKinds: ["offer_l3"] }).group).toBe("open");
  });

  it("shows active, overdue, paused and cancelled subscriptions", () => {
    const sub = (status: string, paidUntil = "2026-12-01") => ({ subscription: { status, paidUntil } });
    expect(jobStage({ ...base, ...sub("active") })).toMatchObject({ key: "active", group: "active" });
    expect(key(sub("active", "2026-11-04"))).toBe("overdue");
    expect(key(sub("active", "2026-11-05"))).toBe("active");
    expect(key(sub("paused"))).toBe("paused");
    expect(jobStage({ ...base, ...sub("cancelled") })).toMatchObject({ key: "cancelled", group: "closed" });
    expect(key({ ...sub("active"), websiteStatus: "suspended" })).toBe("suspended");
    expect(jobStage({ ...base, websiteStatus: "cancelled" }).group).toBe("closed");
  });
});

describe("relevantSentKinds", () => {
  const sent = [
    { kind: "offer_l1", lastSentAt: new Date("2026-01-01") },
    { kind: "offer_budget", lastSentAt: new Date("2026-11-01") },
  ];
  it("counts all emails for a client's only job", () => {
    expect(relevantSentKinds(sent, { createdAt: new Date("2026-10-01"), clientHasOtherJobs: false })).toEqual([
      "offer_l1",
      "offer_budget",
    ]);
  });
  it("ignores emails from an earlier deal when the client has more jobs", () => {
    expect(relevantSentKinds(sent, { createdAt: new Date("2026-10-01"), clientHasOtherJobs: true })).toEqual([
      "offer_budget",
    ]);
  });
});
