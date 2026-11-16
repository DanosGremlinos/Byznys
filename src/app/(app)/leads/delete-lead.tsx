"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteLeadAction } from "./actions";

/** Delete button with a confirmation. `backTo` = where to go after deleting (detail page), else stay. */
export function DeleteLeadButton({
  leadId,
  name,
  backTo = null,
  label = false,
}: {
  leadId: string;
  name: string;
  backTo?: string | null;
  label?: boolean;
}) {
  return (
    <form
      action={deleteLeadAction.bind(null, leadId, backTo)}
      onSubmit={(e) => {
        if (
          !confirm(
            `Smazat lead „${name}“? Smažou se i jeho fotky, recenze a analýza webu. Pokud ho najde další hledání, objeví se znovu jako nový.`,
          )
        )
          e.preventDefault();
      }}
    >
      <Button type="submit" size="sm" variant={label ? "outline" : "ghost"} aria-label={`Smazat lead ${name}`}>
        <Trash2 />
        {label ? "Smazat lead" : null}
      </Button>
    </form>
  );
}
