import { issueSignedToken } from "@vercel/blob";
import {
  handleUpload,
  handleUploadPresigned,
  type HandleUploadBody,
  type HandleUploadPresignedBody,
} from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { blobMode } from "@/lib/blob-config";

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/svg+xml", "image/gif", "application/pdf"];
const MAX_BYTES = 25 * 1024 * 1024;

function checkPath(pathname: string) {
  if (!pathname.startsWith("builder/")) throw new Error("Neplatná cesta");
}

/** Issues upload credentials for Builder assets (photos, logos, PDFs) stored in Vercel Blob. */
export async function POST(request: Request) {
  await requireAdmin();
  const mode = blobMode();
  if (mode === "off") {
    return NextResponse.json({ error: "Úložiště souborů (Vercel Blob) není nastavené." }, { status: 503 });
  }
  const body = await request.json();
  try {
    if (mode === "store") {
      // Newer stores (BLOB_STORE_ID + OIDC): the browser gets a presigned upload URL.
      const result = await handleUploadPresigned({
        body: body as HandleUploadPresignedBody,
        request,
        getSignedToken: async (pathname) => {
          checkPath(pathname);
          const token = await issueSignedToken({
            pathname,
            operations: ["put"],
            allowedContentTypes: ALLOWED,
            maximumSizeInBytes: MAX_BYTES,
            validUntil: Date.now() + 60 * 60 * 1000,
          });
          return {
            token,
            urlOptions: {
              addRandomSuffix: true,
              allowedContentTypes: ALLOWED,
              maximumSizeInBytes: MAX_BYTES,
            },
          };
        },
      });
      return NextResponse.json(result);
    }
    const result = await handleUpload({
      body: body as HandleUploadBody,
      request,
      onBeforeGenerateToken: async (pathname) => {
        checkPath(pathname);
        return { allowedContentTypes: ALLOWED, maximumSizeInBytes: MAX_BYTES, addRandomSuffix: true };
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
