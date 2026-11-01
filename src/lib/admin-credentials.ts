import { timingSafeEqual } from "node:crypto";
import { verifyPassword } from "./password";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Validates the single admin's credentials against ADMIN_EMAIL / ADMIN_PASSWORD_HASH. */
export async function checkAdminCredentials(
  email: string,
  password: string,
  env: Record<string, string | undefined> = process.env,
): Promise<boolean> {
  const adminEmail = env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminHash = env.ADMIN_PASSWORD_HASH;
  if (!adminEmail || !adminHash) return false;
  // Always run the password check so timing does not reveal whether the email matched.
  const passwordOk = await verifyPassword(password, adminHash);
  return safeEqual(email.trim().toLowerCase(), adminEmail) && passwordOk;
}
