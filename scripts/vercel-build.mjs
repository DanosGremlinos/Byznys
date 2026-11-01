// Vercel build entry point.
// Optional, opt-in database setup for *preview* deployments only:
//   set PREVIEW_DB_SETUP=1 in the Vercel "Preview" environment (pointing DATABASE_URL at the
//   Neon dev branch) to run migrations and reseed on each preview build.
// Production builds never touch the database.
import { execSync } from "node:child_process";

const run = (cmd) => execSync(cmd, { stdio: "inherit" });

if (process.env.VERCEL_ENV === "preview" && process.env.PREVIEW_DB_SETUP === "1") {
  console.log("[vercel-build] Preview DB setup: running migrations and seed…");
  run("node node_modules/drizzle-kit/bin.cjs migrate");
  run("node node_modules/tsx/dist/cli.mjs src/db/seed-cli.ts");
}

run("next build");
