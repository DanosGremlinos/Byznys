"use client";

import { Calculator, Mail, Star } from "lucide-react";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { FormMessage } from "@/components/billing/form-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { formatCzk } from "@/lib/format";
import {
  calculatePackages,
  decoyExplanation,
  type OfferedPackage,
  type PackageTemplate,
} from "@/lib/package-calculator";
import { cn } from "@/lib/utils";
import { savePackageOfferAction, type OfferState } from "./actions";

type Props = {
  templates: PackageTemplate[];
  clients: { id: string; name: string }[];
  websites: { id: string; clientId: string; name: string; domain: string | null }[];
  initialClientId: string;
  initialWebsiteId: string;
  initialBudget: string;
};

const parseKc = (v: string) => Number(v.replace(/\s/g, "").replace(",", "."));

function calc(budget: string, templates: PackageTemplate[]) {
  const n = parseKc(budget);
  if (!budget.trim() || !Number.isFinite(n) || n <= 0) return { packages: null, warnings: [], error: null };
  try {
    const r = calculatePackages(Math.round(n * 100), templates);
    return { packages: r.packages, warnings: r.warnings, error: null };
  } catch (err) {
    return { packages: null, warnings: [], error: err instanceof Error ? err.message : "Chyba výpočtu" };
  }
}

export function PackageCalculator({
  templates,
  clients,
  websites,
  initialClientId,
  initialWebsiteId,
  initialBudget,
}: Props) {
  const [state, action, pending] = useActionState<OfferState, FormData>(savePackageOfferAction, {});
  const [budget, setBudget] = useState(initialBudget);
  const [clientId, setClientId] = useState(initialClientId);
  const clientSites = websites.filter((w) => w.clientId === clientId);
  const [websiteId, setWebsiteId] = useState(initialWebsiteId);
  const effectiveWebsite = clientSites.some((w) => w.id === websiteId) ? websiteId : (clientSites[0]?.id ?? "");
  const [edited, setEdited] = useState<OfferedPackage[] | null>(null);
  const result = useMemo(() => calc(budget, templates), [budget, templates]);
  const packages = edited ?? result.packages;
  const explanation = packages ? decoyExplanation(packages) : null;

  const update = (i: number, patch: Partial<OfferedPackage>) => {
    if (!packages) return;
    setEdited(packages.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  };

  return (
    <form action={action} className="grid grid-cols-1 gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="budget">Kolik je klient ochoten platit (Kč / měsíc)</Label>
          <Input
            id="budget"
            name="budget"
            inputMode="decimal"
            placeholder="např. 1000"
            value={budget}
            onChange={(e) => {
              setBudget(e.target.value);
              setEdited(null);
            }}
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="calc-client">Klient</Label>
          <NativeSelect
            id="calc-client"
            name="clientId"
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setWebsiteId("");
            }}
            required
          >
            <option value="">Vyberte klienta…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="calc-website">Zakázka (web)</Label>
          <NativeSelect
            id="calc-website"
            name="websiteId"
            value={effectiveWebsite}
            onChange={(e) => setWebsiteId(e.target.value)}
            disabled={!clientId}
          >
            {clientSites.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
                {w.domain ? ` (${w.domain})` : ""}
              </option>
            ))}
            <option value="">Bez zakázky</option>
          </NativeSelect>
        </div>
      </div>

      {result.error ? <p className="text-sm text-destructive">{result.error}</p> : null}

      {packages ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {packages.map((p, i) => (
              <div
                key={i}
                className={cn(
                  "grid content-start gap-3 rounded-xl border p-4",
                  p.recommended && "border-primary ring-2 ring-primary",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase text-muted-foreground">
                    {["Malý", "Střední – návnada", "Velký – cíl"][i] ?? ""}
                  </span>
                  {p.recommended ? (
                    <Badge>
                      <Star className="size-3" />
                      Nejoblíbenější
                    </Badge>
                  ) : null}
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={`pkg-name-${i}`}>Název</Label>
                  <Input id={`pkg-name-${i}`} value={p.name} onChange={(e) => update(i, { name: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={`pkg-price-${i}`}>Cena (Kč / měsíc)</Label>
                  <Input
                    id={`pkg-price-${i}`}
                    inputMode="decimal"
                    value={String(p.priceHalere / 100)}
                    onChange={(e) => {
                      const n = parseKc(e.target.value);
                      update(i, { priceHalere: Number.isFinite(n) ? Math.round(n * 100) : 0 });
                    }}
                    className="text-lg font-semibold tabular-nums"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={`pkg-features-${i}`}>Co obsahuje (jedna věc na řádek)</Label>
                  <Textarea
                    id={`pkg-features-${i}`}
                    rows={7}
                    value={p.features.join("\n")}
                    onChange={(e) => update(i, { features: e.target.value.split("\n") })}
                  />
                </div>
              </div>
            ))}
          </div>
          <input
            type="hidden"
            name="packages"
            value={JSON.stringify(
              packages.map((p) => ({ ...p, features: p.features.map((f) => f.trim()).filter(Boolean) })),
            )}
          />
          <div className="grid gap-2 rounded-md bg-muted/60 p-3 text-sm">
            <p>
              Rozpočet klienta {formatCzk(Math.round(parseKc(budget) * 100))} → nabídka{" "}
              <strong className="tabular-nums">
                {packages.map((p) => formatCzk(p.priceHalere)).join(" / ")}
              </strong>
              .
            </p>
            {explanation ? <p>{explanation}</p> : null}
            {result.warnings.map((w) => (
              <p key={w} className="text-amber-700">
                {w}
              </p>
            ))}
            {edited ? (
              <p>
                Ceny nebo obsah jste upravili ručně.{" "}
                <button type="button" className="underline" onClick={() => setEdited(null)}>
                  Vrátit na výpočet
                </button>
              </p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="calc-note">Poznámka (volitelné)</Label>
            <Input id="calc-note" name="note" placeholder="např. klient odpověděl „do tisícovky“" />
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          <Calculator className="mr-1 inline size-4" />
          Zadejte částku, kterou klient napsal v odpovědi na „Dotaz na rozpočet“. Balíčky se spočítají hned.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || !packages || !clientId}>
          {pending ? "Ukládám…" : "Uložit balíčky k zakázce"}
        </Button>
        <FormMessage state={state} />
        {state.offerId ? (
          <Button asChild size="sm" variant="outline">
            <Link href={`/messaging/queue/new?client=${state.clientId}&offer=${state.offerId}`}>
              <Mail />
              Připravit e-mail L3 s těmito balíčky
            </Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}
