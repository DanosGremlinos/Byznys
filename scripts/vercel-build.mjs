// Vercel build entry point.
// Optional, opt-in database setup for *preview* deployments only. All of these must hold:
//   VERCEL_ENV=preview, PREVIEW_DB_SETUP=1, and the host of DATABASE_URL_UNPOOLED equal to
//   PREVIEW_DB_EXPECTED_HOST (the Neon dev branch endpoint), so a misconfigured preview can never
//   migrate or seed the production branch. Fake seed data is loaded only when PREVIEW_DB_SEED=1 is
//   also set (and the database is empty) – by default previews keep real data only.
// Production builds never touch the database.
import { execSync } from "node:child_process";

const run = (cmd) => execSync(cmd, { stdio: "inherit" });

if (process.env.VERCEL_ENV === "preview" && process.env.PREVIEW_DB_SETUP === "1") {
  const url = process.env.DATABASE_URL_UNPOOLED ?? "";
  const host = url ? new URL(url).host : "";
  const expected = process.env.PREVIEW_DB_EXPECTED_HOST ?? "";
  if (!expected || host !== expected) {
    throw new Error(
      `[vercel-build] Refusing preview DB setup: database host "${host}" does not match PREVIEW_DB_EXPECTED_HOST.`,
    );
  }
  console.log(`[vercel-build] Preview DB setup on ${host}: migrations…`);
  run("node node_modules/drizzle-kit/bin.cjs migrate");
  if (process.env.PREVIEW_DB_SEED === "1") {
    console.log("[vercel-build] PREVIEW_DB_SEED=1: seeding fake data (if empty)…");
    run("node node_modules/tsx/dist/cli.mjs src/db/seed-cli.ts --if-empty");
  }
}

run("next build");
