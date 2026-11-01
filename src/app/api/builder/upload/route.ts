import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";

/** Issues client-upload tokens for Builder assets (photos, logos, PDFs) stored in Vercel Blob. */
export async function POST(request: Request) {
  await requireAdmin();
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Úložiště souborů (Vercel Blob) není nastavené." }, { status: 503 });
  }
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("builder/")) throw new Error("Neplatná cesta");
        return {
          allowedContentTypes: [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/svg+xml",
            "image/gif",
            "application/pdf",
          ],
          maximumSizeInBytes: 25 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nahrání selhalo" },
      { status: 400 },
    );
  }
}
