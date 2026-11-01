import { describe, expect, it } from "vitest";
import { checkAdminCredentials, loadUsers } from "@/lib/admin-credentials";
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
  it("accepts only configured users", async () => {
    const env = { ADMIN_EMAIL: "Admin@Example.cz", ADMIN_PASSWORD_HASH: await hashPassword("heslo") };
    expect(await checkAdminCredentials("admin@example.cz", "heslo", env)).toEqual({ name: "Admin", email: "admin@example.cz" });
    expect(await checkAdminCredentials(" ADMIN@example.cz ", "heslo", env)).not.toBeNull();
    expect(await checkAdminCredentials("jiny@example.cz", "heslo", env)).toBeNull();
    expect(await checkAdminCredentials("admin@example.cz", "spatne", env)).toBeNull();
  });

  it("denies everything when not configured", async () => {
    expect(await checkAdminCredentials("a@b.cz", "x", {})).toBeNull();
  });

  it("supports additional full-access users from ADMIN_USERS", async () => {
    const env = {
      ADMIN_EMAIL: "daniel@firma.cz",
      ADMIN_NAME: "Daniel",
      ADMIN_PASSWORD_HASH: await hashPassword("heslo-d"),
      ADMIN_USERS: JSON.stringify([
        { name: "Vitek", email: "Vitek@Firma.cz", passwordHash: await hashPassword("heslo-v") },
        { name: "Bez hesla", email: "x@firma.cz" },
      ]),
    };
    expect(loadUsers(env).map((u) => u.name)).toEqual(["Daniel", "Vitek"]);
    expect(await checkAdminCredentials("vitek@firma.cz", "heslo-v", env)).toEqual({ name: "Vitek", email: "vitek@firma.cz" });
    expect(await checkAdminCredentials("vitek@firma.cz", "heslo-d", env)).toBeNull();
    expect(await checkAdminCredentials("daniel@firma.cz", "heslo-d", env)).toEqual({ name: "Daniel", email: "daniel@firma.cz" });
    expect(await checkAdminCredentials("x@firma.cz", "", env)).toBeNull();
  });

  it("ignores invalid ADMIN_USERS without breaking the primary login", async () => {
    const env = { ADMIN_EMAIL: "a@b.cz", ADMIN_PASSWORD_HASH: await hashPassword("p"), ADMIN_USERS: "{not json" };
    expect(loadUsers(env)).toHaveLength(1);
    expect(await checkAdminCredentials("a@b.cz", "p", env)).not.toBeNull();
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
