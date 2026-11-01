import { describe, expect, it } from "vitest";
import { addDays, addMonths, daysBetween, daysOverdue, extendPaidUntil } from "@/lib/dates";

describe("calendar dates", () => {
  it("adds days and months (clamped to month end)", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-03-15", -3)).toBe("2025-12-15");
    expect(daysBetween("2026-10-30", "2026-11-02")).toBe(3);
  });

  it("extends paid-until by whole periods", () => {
    expect(extendPaidUntil("2026-01-31", 1)).toBe("2026-02-28");
    expect(extendPaidUntil("2026-02-28", 1)).toBe("2026-03-31");
    expect(extendPaidUntil("2026-03-14", 1)).toBe("2026-04-14");
    expect(extendPaidUntil("2026-03-14", 12)).toBe("2027-03-14");
    // Nothing paid yet (paid until the day before the start): one payment covers the first month.
    expect(extendPaidUntil("2026-10-31", 1)).toBe("2026-11-30");
  });

  it("counts days overdue from the first unpaid day", () => {
    expect(daysOverdue("2026-11-01", "2026-11-01")).toBe(0);
    expect(daysOverdue("2026-10-31", "2026-11-01")).toBe(1);
    expect(daysOverdue("2026-10-20", "2026-11-01")).toBe(12);
    expect(daysOverdue("2026-12-01", "2026-11-01")).toBe(0);
  });
});
