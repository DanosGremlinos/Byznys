import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { isFetchableUrl } from "@/server/leads/site-analyzer";

/** Same-origin copy of an external image so the browser can read its pixels (logo colour extraction). */
export async function GET(request: Request) {
  await requireAdmin();
  const url = new URL(request.url).searchParams.get("url") ?? "";
  if (!isFetchableUrl(url)) return NextResponse.json({ error: "Neplatná adresa" }, { status: 400 });
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) }).catch(() => null);
  const type = res?.headers.get("content-type") ?? "";
  if (!res?.ok || !type.startsWith("image/"))
    return NextResponse.json({ error: "Obrázek nelze načíst" }, { status: 502 });
  const body = await res.arrayBuffer();
  if (body.byteLength > 5 * 1024 * 1024)
    return NextResponse.json({ error: "Obrázek je příliš velký" }, { status: 413 });
  return new NextResponse(body, {
    headers: { "content-type": type, "cache-control": "private, max-age=3600" },
  });
}
