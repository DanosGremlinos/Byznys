import "server-only";
import { put } from "@vercel/blob";

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Google's photo URLs are temporary. With Vercel Blob configured, the image is copied into our own
 * storage and the permanent URL is returned; otherwise (or on failure) the original URL is kept.
 */
export async function persistPhoto(
  sourceUrl: string,
  pathPrefix: string,
): Promise<{ url: string; persisted: boolean }> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return { url: sourceUrl, persisted: false };
  try {
    const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(20_000) });
    const type = (res.headers.get("content-type") ?? "").split(";")[0];
    if (!res.ok || !type.startsWith("image/")) return { url: sourceUrl, persisted: false };
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength > 10 * 1024 * 1024) return { url: sourceUrl, persisted: false };
    const blob = await put(`${pathPrefix}.${EXT[type] ?? "jpg"}`, bytes, {
      access: "public",
      contentType: type,
      addRandomSuffix: true,
    });
    return { url: blob.url, persisted: true };
  } catch (err) {
    console.error(`[photos] copy to Blob failed: ${err instanceof Error ? err.message : err}`);
    return { url: sourceUrl, persisted: false };
  }
}
