import { timingSafeEqual } from "node:crypto";
import { verifyPassword } from "./password";

export type AppUser = { name: string; email: string; passwordHash: string };

type Env = Record<string, string | undefined>;

/** A valid hash of a random password, used so unknown e-mails take as long as known ones. */
const DUMMY_HASH =
  "scrypt:16384:8:1:AAAAAAAAAAAAAAAAAAAAAA==:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * All users with full access. The primary admin comes from ADMIN_EMAIL / ADMIN_PASSWORD_HASH
 * (optional ADMIN_NAME); further users from ADMIN_USERS, a JSON array:
 *   [{"name":"Vitek","email":"vitek@example.cz","passwordHash":"scrypt:…"}]
 * Invalid entries are ignored (and logged without secrets).
 */
export function loadUsers(env: Env = process.env): AppUser[] {
  const users: AppUser[] = [];
  const primaryEmail = env.ADMIN_EMAIL?.trim().toLowerCase();
  if (primaryEmail && env.ADMIN_PASSWORD_HASH) {
    users.push({ name: env.ADMIN_NAME?.trim() || "Admin", email: primaryEmail, passwordHash: env.ADMIN_PASSWORD_HASH });
  }
  if (env.ADMIN_USERS?.trim()) {
    try {
      const parsed: unknown = JSON.parse(env.ADMIN_USERS);
      if (!Array.isArray(parsed)) throw new Error("not an array");
      for (const u of parsed as Record<string, unknown>[]) {
        const email = typeof u?.email === "string" ? u.email.trim().toLowerCase() : "";
        const passwordHash = typeof u?.passwordHash === "string" ? u.passwordHash : "";
        const name = typeof u?.name === "string" && u.name.trim() ? u.name.trim() : email;
        if (email.includes("@") && passwordHash.startsWith("scrypt:") && !users.some((x) => x.email === email)) {
          users.push({ name, email, passwordHash });
        } else {
          console.error("[auth] ADMIN_USERS: ignoring an invalid or duplicate entry");
        }
      }
    } catch {
      console.error("[auth] ADMIN_USERS is not valid JSON – additional users are disabled");
    }
  }
  return users;
}

/** Returns the matching user for valid credentials, otherwise null. */
export async function checkAdminCredentials(
  email: string,
  password: string,
  env: Env = process.env,
): Promise<{ name: string; email: string } | null> {
  const wanted = email.trim().toLowerCase();
  const user = loadUsers(env).find((u) => safeEqual(u.email, wanted));
  // Always run one password check so timing does not reveal whether the e-mail exists.
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  return user && ok ? { name: user.name, email: user.email } : null;
}
