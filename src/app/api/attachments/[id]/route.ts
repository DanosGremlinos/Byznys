import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { emailAttachments } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-guard";

/** A file uploaded to an email (e.g. the contract for signing), stored in the database (admin only). */
export async function GET(_request: Request, ctx: RouteContext<"/api/attachments/[id]">) {
  await requireAdmin();
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "Příloha nenalezena" }, { status: 404 });
  const att = await db.query.emailAttachments.findFirst({ where: eq(emailAttachments.id, id) });
  if (!att?.content) return NextResponse.json({ error: "Příloha nenalezena" }, { status: 404 });
  return new NextResponse(Buffer.from(att.content), {
    headers: {
      "content-type": att.contentType,
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(att.filename)}`,
    },
  });
}
