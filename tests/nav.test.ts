import { describe, expect, it } from "vitest";
import { NAV_GROUPS, isActive } from "@/components/layout/nav-items";

describe("navigation", () => {
  it("links every module", () => {
    const hrefs = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).toEqual([
      "/",
      "/leads",
      "/builder",
      "/messaging/queue",
      "/messaging/inbox",
      "/messaging/templates",
      "/messaging/stats",
      "/messaging/blacklist",
      "/subscriptions",
      "/overdue",
      "/settings/tiers",
    ]);
  });
  it("highlights the active section", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/leads", "/")).toBe(false);
    expect(isActive("/leads/abc", "/leads")).toBe(true);
    expect(isActive("/leadsx", "/leads")).toBe(false);
  });
});
