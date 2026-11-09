import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

/**
 * Data-access-layer check. The proxy already blocks unauthenticated requests;
 * this is the second line of defence for server actions, route handlers and data loaders.
 */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user;
}
