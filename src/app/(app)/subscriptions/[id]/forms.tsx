"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/billing/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  BILLING_PERIODS,
  PERIOD_LABELS,
  PERIOD_MONTHS,
  PERIOD_UNIT,
  monthlyFromYearly,
  priceForPeriod,
  type BillingPeriod,
} from "@/lib/billing-period";
import {
  cancelSubscriptionAction,
  changePackageAction,
  recordPaymentAction,
  type FormState,
} from "../actions";

export function PaymentForm({
  subscriptionId,
  priceHalere,
  billingPeriod,
  disabled,
}: {
  subscriptionId: string;
  /** Price per billing period. */
  priceHalere: number;
  billingPeriod: BillingPeriod;
  disabled: boolean;
}) {
  const periodMonths = PERIOD_MONTHS[billingPeriod];
  const [state, action, pending] = useActionState<FormState, FormData>(
    recordPaymentAction.bind(null, subscriptionId),
    {},
  );
  // One payment covers one billing period (a month, or a whole year).
  const [months, setMonths] = useState(periodMonths);
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
            defaultValue={String(Math.round((priceHalere * months) / periodMonths) / 100)}
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

type Current = {
  tierId: string | null;
  name: string;
  billingPeriod: BillingPeriod;
  priceHalere: number;
  features: string[];
};

export function PackageForm({
  subscriptionId,
  current,
  disabled,
}: {
  subscriptionId: string;
  current: Current;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    changePackageAction.bind(null, subscriptionId),
    {},
  );
  const [period, setPeriod] = useState<BillingPeriod>(current.billingPeriod);
  // When only the payment period changes, the price is converted with the yearly rule ("2 měsíce zdarma").
  const currentMonthly =
    current.billingPeriod === "yearly" ? monthlyFromYearly(current.priceHalere) : current.priceHalere;
  const priceHalere =
    period === current.billingPeriod ? current.priceHalere : priceForPeriod(currentMonthly, period);
  const values = { name: current.name, features: current.features, priceHalere };
  return (
    <form action={action} className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="pkg-period">Platba</Label>
        <NativeSelect
          id="pkg-period"
          name="billingPeriod"
          value={period}
          onChange={(e) => setPeriod(e.target.value as BillingPeriod)}
        >
          {BILLING_PERIODS.map((p) => (
            <option key={p} value={p}>
              {PERIOD_LABELS[p]}
            </option>
          ))}
        </NativeSelect>
      </div>
      <input type="hidden" name="tierId" value={current.tierId ?? ""} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="pkg-name">Název</Label>
          <Input id="pkg-name" name="name" defaultValue={values.name} key="n" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pkg-price">Cena (Kč / {PERIOD_UNIT[period]})</Label>
          <Input
            id="pkg-price"
            name="price"
            inputMode="decimal"
            defaultValue={String(values.priceHalere / 100)}
            key={`p-${period}`}
            required
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="pkg-features">Co balíček obsahuje (jedna věc na řádek)</Label>
        <Textarea
          id="pkg-features"
          name="features"
          rows={5}
          defaultValue={values.features.join("\n")}
          key="f"
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
