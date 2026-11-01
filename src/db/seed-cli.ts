// Usage: npm run db:seed   (development / preview databases only)
import { createDb } from "./client";
import { runSeed } from "./seed";

export function assertSafeSeedTarget(env: NodeJS.ProcessEnv = process.env) {
  if (env.VERCEL_ENV === "production" || env.SEED_FORBID === "1") {
    throw new Error("Refusing to seed: this looks like the production environment.");
  }
}

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  assertSafeSeedTarget();
  console.log(`Seeding database at ${new URL(url).host} (all existing data will be deleted)…`);
  const db = createDb(url, { max: 1 });
  try {
    console.table(await runSeed(db));
    console.log("Seed complete.");
  } finally {
    await db.$close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
