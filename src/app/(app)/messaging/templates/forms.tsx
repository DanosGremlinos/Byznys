"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deleteCustomTemplate, saveContractTemplate, saveEmailTemplate, type ActionState } from "../actions";

export function EmailTemplateForm({
  t,
}: {
  t: { id: string; name: string; subject: string; body: string; kind: string };
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    saveEmailTemplate.bind(null, t.id),
    {},
  );
  return (
    <form action={action} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`name-${t.id}`}>Název</Label>
          <Input id={`name-${t.id}`} name="name" defaultValue={t.name} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`subject-${t.id}`}>Předmět</Label>
          <Input id={`subject-${t.id}`} name="subject" defaultValue={t.subject} required />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`body-${t.id}`}>Text</Label>
        <Textarea
          id={`body-${t.id}`}
          name="body"
          rows={10}
          defaultValue={t.body}
          className="font-mono text-sm"
          required
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          Uložit
        </Button>
        {t.kind === "custom" ? (
          <Button type="submit" size="sm" variant="ghost" formAction={deleteCustomTemplate.bind(null, t.id)}>
            Smazat
          </Button>
        ) : null}
        {state.error ? <span className="text-sm text-destructive">{state.error}</span> : null}
        {state.ok ? <span className="text-sm text-emerald-700">{state.ok}</span> : null}
      </div>
    </form>
  );
}

export function ContractTemplateForm({ t }: { t: { id: string; name: string; body: string } }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    saveContractTemplate.bind(null, t.id),
    {},
  );
  return (
    <form action={action} className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor={`cname-${t.id}`}>Název</Label>
        <Input id={`cname-${t.id}`} name="name" defaultValue={t.name} required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`cbody-${t.id}`}>
          Text smlouvy (Markdown: # nadpis, ## sekce, **tučně**, - odrážky)
        </Label>
        <Textarea
          id={`cbody-${t.id}`}
          name="body"
          rows={18}
          defaultValue={t.body}
          className="font-mono text-xs"
          required
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          Uložit šablonu smlouvy
        </Button>
        {state.error ? <span className="text-sm text-destructive">{state.error}</span> : null}
        {state.ok ? <span className="text-sm text-emerald-700">{state.ok}</span> : null}
      </div>
    </form>
  );
}
