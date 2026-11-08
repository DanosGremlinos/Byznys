import { NextResponse } from "next/server";
import { db } from "@/db";
import { requireAdmin } from "@/lib/auth-guard";
import { exportLead } from "@/server/leads/privacy";

/** Everything stored about a lead as JSON (GDPR access / portability request). Admin only. */
export async function GET(_request: Request, ctx: RouteContext<"/api/leads/[id]/export">) {
  await requireAdmin();
  const { id } = await ctx.params;
  const data = await exportLead(db, id);
  if (!data) return NextResponse.json({ error: "Lead nenalezen" }, { status: 404 });
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="lead-${id}.json"`,
    },
  });
}
