"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/billing/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveTier, type TierState } from "./actions";

type Tier = {
  id: string;
  name: string;
  description: string | null;
  monthlyPriceHalere: number;
  features: string[];
  isActive: boolean;
  sortOrder: number;
};

export function TierForm({ tier }: { tier: Tier | null }) {
  const [state, action, pending] = useActionState<TierState, FormData>(
    saveTier.bind(null, tier?.id ?? null),
    {},
  );
  const id = tier?.id ?? "new";
  return (
    <form action={action} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_6rem]">
        <div className="grid gap-1.5">
          <Label htmlFor={`name-${id}`}>Název</Label>
          <Input id={`name-${id}`} name="name" defaultValue={tier?.name} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`price-${id}`}>Výchozí cena (Kč / měsíc)</Label>
          <Input
            id={`price-${id}`}
            name="price"
            inputMode="decimal"
            defaultValue={tier ? String(tier.monthlyPriceHalere / 100) : ""}
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`sort-${id}`}>Pořadí</Label>
          <Input
            id={`sort-${id}`}
            name="sortOrder"
            type="number"
            min={0}
            defaultValue={tier?.sortOrder ?? 10}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`desc-${id}`}>Popis</Label>
        <Input id={`desc-${id}`} name="description" defaultValue={tier?.description ?? ""} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`features-${id}`}>Funkce (jedna na řádek)</Label>
        <Textarea id={`features-${id}`} name="features" rows={5} defaultValue={tier?.features.join("\n")} />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={tier?.isActive ?? true} />
          Aktivní (nabízet v nových nabídkách)
        </label>
        <Button type="submit" size="sm" disabled={pending}>
          {tier ? "Uložit" : "Přidat šablonu"}
        </Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
