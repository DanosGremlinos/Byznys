import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { contracts } from "@/db/schema";
import { slugify } from "@/db/seed-data";
import { requireAdmin } from "@/lib/auth-guard";
import { renderContractPdf } from "@/server/contracts/pdf";

/** Contract PDF, rendered on demand from the stored contract text (admin only). */
export async function GET(_request: Request, ctx: RouteContext<"/api/contracts/[id]/pdf">) {
  await requireAdmin();
  const { id } = await ctx.params;
  const contract = await db.query.contracts.findFirst({ where: eq(contracts.id, id) });
  if (!contract) return NextResponse.json({ error: "Smlouva nenalezena" }, { status: 404 });
  const pdf = await renderContractPdf(contract.body, contract.title);
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="smlouva-${slugify(contract.title)}.pdf"`,
    },
  });
}
