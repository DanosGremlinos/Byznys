import { describe, expect, it } from "vitest";
import { czkToHalere, formatCzk, formatDate, formatDateTime, pragueToday } from "@/lib/format";

const nb = (s: string) => s.replace(/[  ]/g, " ");

describe("formatCzk", () => {
  it("formats haléře as Czech crowns", () => {
    expect(nb(formatCzk(99_000))).toBe("990 Kč");
    expect(nb(formatCzk(199_000))).toBe("1 990 Kč");
    expect(nb(formatCzk(12_345))).toBe("123,45 Kč");
  });
  it("converts crowns to haléře", () => {
    expect(czkToHalere(990)).toBe(99_000);
    expect(czkToHalere(123.45)).toBe(12_345);
  });
});

describe("formatDate", () => {
  it("formats calendar dates as d. M. yyyy without timezone shift", () => {
    expect(formatDate("2026-11-01")).toBe("1. 11. 2026");
    expect(formatDate("2026-01-09")).toBe("9. 1. 2026");
  });
  it("converts instants to Europe/Prague", () => {
    // 23:30 UTC on 31 Dec is already 1 Jan in Prague (UTC+1).
    expect(formatDate(new Date("2026-12-31T23:30:00Z"))).toBe("1. 1. 2027");
    // Summer time (UTC+2).
    expect(formatDateTime("2026-07-15T22:15:00Z")).toBe("16. 7. 2026 00:15");
  });
  it("returns today's date in Prague", () => {
    expect(pragueToday(new Date("2026-03-28T23:30:00Z"))).toBe("2026-03-29");
    expect(pragueToday(new Date("2026-06-30T21:59:00Z"))).toBe("2026-06-30");
  });
});
