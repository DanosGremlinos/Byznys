import Link from "next/link";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Step = {
  id: string;
  step: number;
  dayOffset: number;
  status: string;
  scheduledFor: Date;
  emailId: string | null;
};

const STEP_TITLES = ["Přátelská připomínka", "Upomínka", "Poslední výzva"];
const STATUS: Record<string, { label: string; tone: string }> = {
  pending: { label: "Čeká", tone: "bg-slate-100 text-slate-700" },
  queued_for_approval: { label: "Ke schválení", tone: "bg-amber-100 text-amber-800" },
  sent: { label: "Odesláno", tone: "bg-emerald-100 text-emerald-800" },
  skipped: { label: "Přeskočeno", tone: "bg-slate-100 text-slate-500" },
  cancelled: { label: "Zrušeno", tone: "bg-slate-100 text-slate-500 line-through" },
};

export const RUN_STATUS_LABELS: Record<string, string> = {
  active: "Upomínky běží",
  paused: "Pozastaveno",
  stopped_paid: "Zaplaceno – zastaveno",
  completed: "Dokončeno",
  cancelled: "Zrušeno",
};

export function DunningStepsView({ steps }: { steps: Step[] }) {
  return (
    <ol className="grid gap-1.5 sm:grid-cols-3">
      {steps.map((s) => {
        const st = STATUS[s.status] ?? { label: s.status, tone: "" };
        return (
          <li key={s.id} className="grid gap-0.5 rounded-md border p-2 text-xs">
            <span className="font-medium">
              {s.step}. {STEP_TITLES[s.step - 1]}{" "}
              <span className="text-muted-foreground">(den {s.dayOffset})</span>
            </span>
            <span className="text-muted-foreground" title={formatDateTime(s.scheduledFor)}>
              {formatDate(s.scheduledFor)}
            </span>
            <span className="flex items-center gap-2">
              <span className={cn("rounded px-1.5 py-0.5", st.tone)}>{st.label}</span>
              {s.emailId && (s.status === "queued_for_approval" || s.status === "sent") ? (
                <Link href={`/messaging/queue?email=${s.emailId}`} className="underline">
                  e-mail
                </Link>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
