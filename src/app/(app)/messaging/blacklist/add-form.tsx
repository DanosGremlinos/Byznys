"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addBlacklistEntry, type ActionState } from "../actions";

export function AddBlacklistForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(addBlacklistEntry, {});
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
      <Input name="email" type="email" placeholder="adresa@firma.cz" required aria-label="E-mail" />
      <Input name="note" placeholder="Poznámka (volitelné)" aria-label="Poznámka" />
      <Button type="submit" disabled={pending}>
        Přidat na blacklist
      </Button>
      {state.error ? <p className="text-sm text-destructive sm:col-span-3">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-emerald-700 sm:col-span-3">{state.ok}</p> : null}
    </form>
  );
}
