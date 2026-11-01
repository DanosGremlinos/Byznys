"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/billing/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  cancelSubscriptionAction,
  changePackageAction,
  recordPaymentAction,
  type FormState,
} from "../actions";

export function PaymentForm({
  subscriptionId,
  priceHalere,
  disabled,
}: {
  subscriptionId: string;
  priceHalere: number;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    recordPaymentAction.bind(null, subscriptionId),
    {},
  );
  const [months, setMonths] = useState(1);
  return (
    <form action={action} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-[7rem_1fr]">
        <div className="grid gap-1.5">
          <Label htmlFor="months">Měsíců</Label>
          <Input
            id="months"
            name="months"
            type="number"
            min={1}
            max={36}
            value={months}
            onChange={(e) => setMonths(Number(e.target.value) || 1)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="amount">Přijatá částka (Kč)</Label>
          <Input
            id="amount"
            name="amount"
            inputMode="decimal"
            defaultValue={String((priceHalere * months) / 100)}
            key={months}
          />
        </div>
      </div>
      <Input name="note" placeholder="Poznámka (např. převod z účtu)" aria-label="Poznámka" />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || disabled}>
          Zaplaceno
        </Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

type Tier = { id: string; name: string; monthlyPriceHalere: number; features: string[] };

export function PackageForm({
  subscriptionId,
  current,
  tiers,
  disabled,
}: {
  subscriptionId: string;
  current: { tierId: string | null; name: string; priceHalere: number; features: string[] };
  tiers: Tier[];
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    changePackageAction.bind(null, subscriptionId),
    {},
  );
  const [tierId, setTierId] = useState(current.tierId ?? "");
  const tier = tiers.find((t) => t.id === tierId);
  const isCurrent = tierId === (current.tierId ?? "");
  const values =
    isCurrent || !tier
      ? current
      : { name: tier.name, priceHalere: tier.monthlyPriceHalere, features: tier.features };
  return (
    <form action={action} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="tierId">Šablona</Label>
          <NativeSelect id="tierId" name="tierId" value={tierId} onChange={(e) => setTierId(e.target.value)}>
            {tiers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
            <option value="">Vlastní</option>
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pkg-name">Název</Label>
          <Input id="pkg-name" name="name" defaultValue={values.name} key={`n-${tierId}`} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pkg-price">Cena (Kč / měsíc)</Label>
          <Input
            id="pkg-price"
            name="price"
            inputMode="decimal"
            defaultValue={String(values.priceHalere / 100)}
            key={`p-${tierId}`}
            required
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="pkg-features">Funkce (jedna na řádek)</Label>
        <Textarea
          id="pkg-features"
          name="features"
          rows={5}
          defaultValue={values.features.join("\n")}
          key={`f-${tierId}`}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="outline" disabled={pending || disabled}>
          Uložit změnu balíčku
        </Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function CancelForm({ subscriptionId }: { subscriptionId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    cancelSubscriptionAction.bind(null, subscriptionId),
    {},
  );
  return (
    <form action={action} className="grid gap-2">
      <Input name="reason" placeholder="Důvod zrušení" aria-label="Důvod zrušení" />
      <div className="flex items-center gap-3">
        <Button type="submit" variant="destructive" size="sm" disabled={pending}>
          Zrušit předplatné
        </Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
