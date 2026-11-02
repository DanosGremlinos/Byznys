// How the app talks to Vercel Blob:
//  - "token": classic stores (BLOB_READ_WRITE_TOKEN), client uploads via client tokens
//  - "store": newer stores connected with BLOB_STORE_ID (+ OIDC on Vercel), client uploads via presigned URLs
//  - "off":   no Blob store connected
export type BlobMode = "token" | "store" | "off";

export function blobMode(env: Record<string, string | undefined> = process.env): BlobMode {
  if (env.BLOB_READ_WRITE_TOKEN) return "token";
  if (env.BLOB_STORE_ID) return "store";
  return "off";
}

export const blobEnabled = () => blobMode() !== "off";
