"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import type { RevenuePoint } from "@/server/dashboard";

const BAR = "#2a78d6"; // single sequential series (reference palette blue 450)
const MONTHS = ["led", "úno", "bře", "dub", "kvě", "čvn", "čvc", "srp", "zář", "říj", "lis", "pro"];

const czk = (halere: number) =>
  new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 }).format(
    halere / 100,
  );
const compactCzk = (halere: number) => {
  const v = halere / 100;
  return v >= 10_000 ? `${Math.round(v / 1000)} tis.` : new Intl.NumberFormat("cs-CZ").format(v);
};
const periodLabel = (p: string) =>
  p.length === 7 ? `${MONTHS[Number(p.slice(5)) - 1]} ${p.slice(2, 4)}` : p;

export function RevenueChart({ monthly, yearly }: { monthly: RevenuePoint[]; yearly: RevenuePoint[] }) {
  const [mode, setMode] = useState<"monthly" | "yearly">("monthly");
  const data = (mode === "monthly" ? monthly : yearly).map((d) => ({ ...d, label: periodLabel(d.period) }));
  const total = data.reduce((s, d) => s + d.amountHalere, 0);

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Přijaté platby {mode === "monthly" ? "za posledních 12 měsíců" : "po letech"}:{" "}
          <span className="font-medium text-foreground">{czk(total)}</span>
        </p>
        <div className="flex rounded-md border p-0.5" role="group" aria-label="Období">
          {(["monthly", "yearly"] as const).map((m) => (
            <Button
              key={m}
              type="button"
              size="xs"
              variant={mode === m ? "secondary" : "ghost"}
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
            >
              {m === "monthly" ? "Měsíčně" : "Ročně"}
            </Button>
          ))}
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <YAxis
              tickFormatter={compactCzk}
              tickLine={false}
              axisLine={false}
              width={56}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              formatter={(v) => [czk(Number(v)), "Tržby"]}
              labelFormatter={(l) => String(l)}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--popover)",
                color: "var(--popover-foreground)",
                fontSize: 12,
              }}
            />
            <Bar dataKey="amountHalere" fill={BAR} maxBarSize={24} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Zobrazit jako tabulku</summary>
        <table className="mt-2 w-full max-w-sm text-sm">
          <tbody>
            {data.map((d) => (
              <tr key={d.period} className="border-b last:border-0">
                <td className="py-1">{d.label}</td>
                <td className="py-1 text-right tabular-nums">{czk(d.amountHalere)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
