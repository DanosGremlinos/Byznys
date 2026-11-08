import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // DB integration tests share one throwaway database, so files run one after another.
    fileParallelism: false,
    env: {
      UNSUBSCRIBE_SECRET: "test-unsubscribe-secret",
      APP_URL: "https://app.test",
      EMAIL_FROM: "Test Weby <nabidky@weby.test>",
      PROVIDER_NAME: "Test Weby s.r.o.",
      PROVIDER_ICO: "12345678",
      PROVIDER_ADDRESS: "Testovací 1, 602 00 Brno",
    },
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
