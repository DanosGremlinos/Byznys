"use client";

import { Search } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { startLeadSearch, type SearchState } from "./actions";

const CATEGORY_SUGGESTIONS = [
  "pizzerie",
  "restaurace",
  "kavárna",
  "kadeřnictví",
  "kosmetický salon",
  "barbershop",
  "instalatér",
  "elektrikář",
  "truhlářství",
  "autoservis",
  "pekárna",
  "fitness",
];

export function LeadSearchForm() {
  const [state, action, pending] = useActionState<SearchState, FormData>(startLeadSearch, {});
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <div className="grid gap-1.5">
        <Label htmlFor="category">Kategorie</Label>
        <Input
          id="category"
          name="category"
          list="category-suggestions"
          placeholder="např. pizzerie"
          required
        />
        <datalist id="category-suggestions">
          {CATEGORY_SUGGESTIONS.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="city">Město / oblast</Label>
        <Input id="city" name="city" placeholder="např. Brno-střed" required />
      </div>
      <Button type="submit" disabled={pending}>
        <Search />
        {pending ? "Spouštím…" : "Hledat"}
      </Button>
      {state.error ? <p className="text-sm text-destructive sm:col-span-3">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-emerald-700 sm:col-span-3">{state.ok}</p> : null}
    </form>
  );
}
