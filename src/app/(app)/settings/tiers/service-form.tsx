"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/billing/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { removeService, saveService, type ServiceState } from "./actions";

type Service = {
  id: string;
  name: string;
  description: string | null;
  monthlyPriceHalere: number;
  required: boolean;
  sortOrder: number;
  isActive: boolean;
};

/** One row of the services list (or the "new service" form when `service` is null). */
export function ServiceForm({ service, nextSortOrder = 10 }: { service: Service | null; nextSortOrder?: number }) {
  const [state, action, pending] = useActionState<ServiceState, FormData>(
    saveService.bind(null, service?.id ?? null),
    {},
  );
  const id = service?.id ?? "new";
  return (
    <form
      action={action}
      className="grid gap-3 border-b pb-4 last:border-b-0 last:pb-0 sm:grid-cols-[1fr_8rem_6rem] sm:items-end"
    >
      <div className="grid gap-1.5">
        <Label htmlFor={`sname-${id}`}>Služba</Label>
        <Input id={`sname-${id}`} name="name" defaultValue={service?.name} required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`sprice-${id}`}>Kč / měsíc</Label>
        <Input
          id={`sprice-${id}`}
          name="price"
          inputMode="decimal"
          defaultValue={service ? String(service.monthlyPriceHalere / 100) : ""}
          placeholder="0"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`ssort-${id}`}>Pořadí</Label>
        <Input
          id={`ssort-${id}`}
          name="sortOrder"
          type="number"
          min={0}
          defaultValue={service?.sortOrder ?? nextSortOrder}
        />
      </div>
      <div className="grid gap-1.5 sm:col-span-3">
        <Input
          name="description"
          defaultValue={service?.description ?? ""}
          placeholder="Popis (nepovinné, jen pro vás)"
          aria-label="Popis"
        />
      </div>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="required" defaultChecked={service?.required ?? false} />
          Vždy v balíčku (povinná)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={service?.isActive ?? true} />
          Nabízet
        </label>
        <Button type="submit" size="sm" disabled={pending}>
          {service ? "Uložit" : "Přidat službu"}
        </Button>
        {service ? (
          <Button
            type="submit"
            size="sm"
            variant="ghost"
            formAction={removeService.bind(null, service.id)}
            formNoValidate
            onClick={(e) => {
              if (!confirm(`Smazat službu „${service.name}“? Už uložené balíčky se nezmění.`)) e.preventDefault();
            }}
          >
            Smazat
          </Button>
        ) : null}
        <FormMessage state={state} />
      </div>
    </form>
  );
}
