"use client";

import { Trash2 } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { deleteJobAction, type DeleteJobState } from "../actions";

export function DeleteJobButton({ websiteId, name }: { websiteId: string; name: string }) {
  const [state, action, pending] = useActionState<DeleteJobState, FormData>(
    () => deleteJobAction(websiteId),
    {},
  );
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !confirm(
            `Opravdu odebrat zakázku „${name}“? Smažou se i balíčky spočítané pro tuto zakázku. Klient, e-maily, projekty v Builderu a smlouvy zůstanou.`,
          )
        )
          e.preventDefault();
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        <Trash2 />
        {pending ? "Odebírám…" : "Odebrat zakázku"}
      </Button>
      {state.error ? <span className="text-sm text-destructive">{state.error}</span> : null}
    </form>
  );
}
