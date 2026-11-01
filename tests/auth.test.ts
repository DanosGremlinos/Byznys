import { describe, expect, it } from "vitest";
import { checkAdminCredentials } from "@/lib/admin-credentials";
import { hashPassword, verifyPassword } from "@/lib/password";
import { isPublicPath } from "@/lib/public-paths";

describe("password hashing", () => {
  it("verifies the correct password and rejects others", async () => {
    const hash = await hashPassword("Tajné-heslo-123");
    expect(hash.startsWith("scrypt:")).toBe(true);
    expect(hash).not.toContain("$");
    expect(await verifyPassword("Tajné-heslo-123", hash)).toBe(true);
    expect(await verifyPassword("tajné-heslo-123", hash)).toBe(false);
  });
  it("produces a different salt each time", async () => {
    expect(await hashPassword("x")).not.toBe(await hashPassword("x"));
  });
  it("rejects malformed hashes", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "plain-text")).toBe(false);
    expect(await verifyPassword("x", "scrypt:1:1:1::")).toBe(false);
  });
});

describe("admin credentials", () => {
  it("accepts only the configured admin", async () => {
    const env = { ADMIN_EMAIL: "Admin@Example.cz", ADMIN_PASSWORD_HASH: await hashPassword("heslo") };
    expect(await checkAdminCredentials("admin@example.cz", "heslo", env)).toBe(true);
    expect(await checkAdminCredentials(" ADMIN@example.cz ", "heslo", env)).toBe(true);
    expect(await checkAdminCredentials("jiny@example.cz", "heslo", env)).toBe(false);
    expect(await checkAdminCredentials("admin@example.cz", "spatne", env)).toBe(false);
  });
  it("denies everything when not configured", async () => {
    expect(await checkAdminCredentials("a@b.cz", "x", {})).toBe(false);
  });
});

describe("route protection", () => {
  it("treats only login, auth, webhook, cron and unsubscribe routes as public", () => {
    for (const p of [
      "/login",
      "/api/auth/session",
      "/api/webhooks/mailgun",
      "/api/cron/dunning",
      "/unsubscribe/abc",
    ]) {
      expect(isPublicPath(p), p).toBe(true);
    }
    for (const p of [
      "/",
      "/leads",
      "/builder/123",
      "/messaging/inbox",
      "/overdue",
      "/settings/tiers",
      "/api/jobs/1",
      "/login-x",
      "/api/authx",
      "/unsubscribe",
    ]) {
      expect(isPublicPath(p), p).toBe(false);
    }
  });
});
