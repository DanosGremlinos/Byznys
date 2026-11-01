import { NextResponse } from "next/server";
import { db } from "@/db";
import { addToBlacklist } from "@/server/email/blacklist";
import { verifyUnsubscribeToken } from "@/server/email/render";

function emailFrom(token: string): string | null {
  const secret = process.env.UNSUBSCRIBE_SECRET || process.env.AUTH_SECRET;
  return secret ? verifyUnsubscribeToken(token, secret) : null;
}

/** Public. Handles both the confirmation form and RFC 8058 one-click (List-Unsubscribe-Post). */
export async function POST(request: Request, ctx: RouteContext<"/api/unsubscribe/[token]">) {
  const { token } = await ctx.params;
  const email = emailFrom(token);
  if (!email) return NextResponse.json({ error: "Neplatný odkaz" }, { status: 400 });
  await addToBlacklist(db, email, "unsubscribed", "Odhlášeno odkazem v e-mailu");
  const oneClick =
    (request.headers.get("content-type") ?? "").includes("form") &&
    (await request.text()).includes("List-Unsubscribe=One-Click");
  if (oneClick) return new NextResponse(null, { status: 200 });
  return NextResponse.redirect(new URL(`/unsubscribe/${token}?done=1`, request.url), 303);
}

export async function GET(request: Request, ctx: RouteContext<"/api/unsubscribe/[token]">) {
  const { token } = await ctx.params;
  return NextResponse.redirect(new URL(`/unsubscribe/${token}`, request.url));
}
