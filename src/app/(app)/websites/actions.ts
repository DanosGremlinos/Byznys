"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { requireAdmin } from "@/lib/auth-guard";
import { deleteJob } from "@/server/websites/jobs";

/** "Odebrat zakázku" on the job detail: deletes the job and goes back to the dashboard. */
export async function deleteJobAction(websiteId: string): Promise<{ error?: string }> {
  await requireAdmin();
  try {
    await deleteJob(db, websiteId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Zakázku se nepodařilo odebrat." };
  }
  redirect("/");
}
