"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { requireAdmin } from "@/lib/auth-guard";
import { deleteJob } from "@/server/websites/jobs";

export type DeleteJobState = { error?: string };

export async function deleteJobAction(websiteId: string): Promise<DeleteJobState> {
  await requireAdmin();
  try {
    await deleteJob(db, websiteId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Zakázku se nepodařilo odebrat." };
  }
  refresh();
  redirect("/");
}
