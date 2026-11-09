import "server-only";
import { db } from "@/db";
import { registerJobHandler } from "@/server/jobs/runner";
import { processDunning } from "./dunning";

/** "dunning_run" background job: the daily overdue check (cron or "Zkontrolovat teď"). */
registerJobHandler("dunning_run", async (ctx) => {
  await ctx.save({}, { done: 0, total: 1, message: "Kontroluji neuhrazené platby…" });
  const s = await processDunning(db);
  await ctx.save(s, {
    done: 1,
    total: 1,
    message: `Hotovo: ${s.started} nových, ${s.queued} upomínek ke schválení, ${s.stoppedPaid} zaplaceno, ${s.completed} dokončeno`,
  });
  return true;
});
