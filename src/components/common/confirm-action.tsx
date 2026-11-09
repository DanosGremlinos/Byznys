"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";

type State = { error?: string; ok?: string };

/** A button that asks for confirmation, then runs a server action and shows its error inline. */
export function ConfirmAction({
  action,
  confirmText,
  label,
  size = "sm",
  variant = "outline",
  iconOnly = false,
}: {
  action: (prev: State, formData: FormData) => Promise<State>;
  confirmText: string;
  label: string;
  size?: "sm" | "default" | "icon-sm";
  variant?: "outline" | "ghost" | "destructive";
  iconOnly?: boolean;
}) {
  const [state, run, pending] = useActionState<State, FormData>(action, {});
  return (
    <form
      action={run}
      onSubmit={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
      className="inline-flex flex-col items-end gap-1"
    >
      <Button type="submit" size={size} variant={variant} disabled={pending} aria-label={label} title={label}>
        {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
        {iconOnly ? null : label}
      </Button>
      {state.error ? <p className="max-w-xs text-right text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}
