import { SCORE_FACTOR_LABELS, type ScoreFactorKey } from "@/config/scoring";
import type { ScoreFactorResult } from "@/db/schema/types";
import { cn } from "@/lib/utils";

export function ScoreBadge({ score, className }: { score: number | null; className?: string }) {
  const tone =
    score === null
      ? "bg-muted text-muted-foreground"
      : score >= 70
        ? "bg-emerald-600 text-white"
        : score >= 40
          ? "bg-amber-500 text-white"
          : "bg-slate-200 text-slate-700";
  return (
    <span
      className={cn(
        "inline-flex h-8 w-11 items-center justify-center rounded-md text-sm font-semibold tabular-nums",
        tone,
        className,
      )}
      title="Skóre příležitosti (0–100)"
    >
      {score ?? "–"}
    </span>
  );
}

export function factorLabel(key: string) {
  return SCORE_FACTOR_LABELS[key as ScoreFactorKey] ?? key;
}

/** Chips of the factors that fired, with points and the reason on hover. */
export function FiredFactors({ factors, limit }: { factors: ScoreFactorResult[] | null; limit?: number }) {
  const fired = (factors ?? []).filter((f) => f.fired);
  if (!fired.length) return <span className="text-xs text-muted-foreground">žádné faktory</span>;
  const shown = limit ? fired.slice(0, limit) : fired;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((f) => (
        <span
          key={f.key}
          title={f.detail}
          className="inline-flex items-center gap-1 rounded border bg-background px-1.5 py-0.5 text-xs"
        >
          {factorLabel(f.key)}
          <span className="font-medium text-muted-foreground">+{f.points}</span>
        </span>
      ))}
      {limit && fired.length > limit ? (
        <span className="text-xs text-muted-foreground">+{fired.length - limit}</span>
      ) : null}
    </div>
  );
}

/** Full breakdown: every factor, fired or not, with weight, points and reason. */
export function FactorTable({ factors }: { factors: ScoreFactorResult[] | null }) {
  if (!factors?.length) return <p className="text-sm text-muted-foreground">Skóre zatím nebylo spočítáno.</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-xs text-muted-foreground">
          <th className="py-1.5 font-medium">Faktor</th>
          <th className="py-1.5 font-medium">Důvod</th>
          <th className="py-1.5 pl-3 text-right font-medium">Váha</th>
          <th className="py-1.5 pl-3 text-right font-medium">Body</th>
        </tr>
      </thead>
      <tbody>
        {factors.map((f) => (
          <tr key={f.key} className={cn("border-b last:border-0", !f.fired && "text-muted-foreground")}>
            <td className="py-1.5 pr-2">
              <span
                className={cn(
                  "mr-1.5 inline-block size-2 rounded-full",
                  f.fired ? "bg-emerald-600" : "bg-slate-300",
                )}
              />
              {factorLabel(f.key)}
            </td>
            <td className="py-1.5 pr-2">{f.detail ?? "–"}</td>
            <td className="py-1.5 text-right tabular-nums">{f.weight}</td>
            <td className="py-1.5 text-right font-medium tabular-nums">{f.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
