"use client";

import { Sparkles } from "lucide-react";
import { useActionState, useEffect, useTransition } from "react";
import { CLASSIFICATION_LABELS } from "@/components/messaging/labels";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  markThreadRead,
  overrideClassification,
  reclassify,
  simulateInbound,
  startReply,
  type ActionState,
} from "../actions";

export function MarkRead({ threadId, unread }: { threadId: string; unread: number }) {
  useEffect(() => {
    if (unread > 0) void markThreadRead(threadId);
  }, [threadId, unread]);
  return null;
}

export function ClassificationControl({
  emailId,
  value,
  aiEnabled,
}: {
  emailId: string;
  value: string | null;
  aiEnabled: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <NativeSelect
        aria-label="Klasifikace"
        className="h-8 w-48 text-xs"
        value={value ?? ""}
        disabled={pending}
        onChange={(e) => start(() => overrideClassification(emailId, e.target.value))}
      >
        <option value="">Neklasifikováno</option>
        {Object.entries(CLASSIFICATION_LABELS).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </NativeSelect>
      {aiEnabled ? (
        <Button
          type="button"
          size="xs"
          variant="ghost"
          disabled={pending}
          onClick={() => start(async () => void (await reclassify(emailId)))}
        >
          <Sparkles />
          AI
        </Button>
      ) : null}
    </div>
  );
}

export function ReplyForm({ threadId, aiEnabled }: { threadId: string; aiEnabled: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(startReply.bind(null, threadId), {});
  return (
    <form action={action} className="grid gap-2">
      <Textarea
        name="body"
        rows={5}
        placeholder="Text odpovědi (nebo nechte prázdné a nechte AI navrhnout)…"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Připravuji…" : "Připravit odpověď ke schválení"}
        </Button>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="useAi" disabled={!aiEnabled} />
          Navrhnout text pomocí AI {aiEnabled ? "" : "(není nastavena)"}
        </label>
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}

export function SimulateInbound({ threadId }: { threadId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    simulateInbound.bind(null, threadId),
    {},
  );
  return (
    <form action={action} className="grid gap-2 rounded-md border border-dashed p-3">
      <p className="text-xs text-muted-foreground">
        Vývojový režim: simulace příchozí odpovědi od klienta (ve skutečném provozu přijde přes Mailgun).
      </p>
      <Textarea name="text" rows={3} placeholder="Např. Dobrý den, návrh se nám líbí, kolik by to stálo?" />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          Přidat testovací odpověď
        </Button>
        {state.error ? <span className="text-sm text-destructive">{state.error}</span> : null}
        {state.ok ? <span className="text-sm text-emerald-700">{state.ok}</span> : null}
      </div>
    </form>
  );
}
