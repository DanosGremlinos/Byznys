import { describe, expect, it } from "vitest";
import { blobMode } from "@/lib/blob-config";

describe("Vercel Blob mode", () => {
  it("prefers a read-write token, then a connected store, else off", () => {
    expect(blobMode({ BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_x", BLOB_STORE_ID: "store_1" })).toBe("token");
    expect(blobMode({ BLOB_STORE_ID: "store_1" })).toBe("store");
    expect(blobMode({})).toBe("off");
  });
});
