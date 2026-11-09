"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/billing/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { createSubscriptionAction, type FormState } from "../actions";

type Props = {
  clients: { id: string; name: string }[];
  websites: { id: string; clientId: string; name: string; domain: string | null }[];
  tiers: { id: string; name: string; monthlyPriceHalere: number; features: string[] }[];
  initialClientId: string;
  initialWebsiteId: string;
  /** Package chosen from saved calculator packages (prefills name, price, features). */
  fromOffer: {
    offerId: string;
    index: number;
    tierId: string | null;
    name: string;
    priceHalere: number;
    features: string[];
  } | null;
  today: string;
  dayBefore: string;
};

export function NewSubscriptionForm({
  clients,
  websites,
  tiers,
  initialClientId,
  initialWebsiteId,
  fromOffer,
  today,
  dayBefore,
}: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(createSubscriptionAction, {});
  const [clientId, setClientId] = useState(initialClientId);
  const clientSites = websites.filter((w) => w.clientId === clientId);
  const [websiteId, setWebsiteId] = useState<string>(initialWebsiteId);
  const effectiveWebsite =
    websiteId === "new" || clientSites.some((w) => w.id === websiteId) ? websiteId : (clientSites[0]?.id ?? "new");
  const [tierId, setTierId] = useState(fromOffer ? (fromOffer.tierId ?? "") : (tiers[0]?.id ?? ""));
  // Until the template is changed by hand, the package from the saved offer is used.
  const [useOffer, setUseOffer] = useState(fromOffer !== null);
  const template = tiers.find((t) => t.id === tierId);
  const tier =
    useOffer && fromOffer
      ? { name: fromOffer.name, monthlyPriceHalere: fromOffer.priceHalere, features: fromOffer.features }
      : template;
  const clientName = clients.find((c) => c.id === clientId)?.name ?? "";

  return (
    <form action={action} className="grid max-w-3xl gap-5">
      {useOffer && fromOffer ? (
        <>
          <input type="hidden" name="packageOfferId" value={fromOffer.offerId} />
          <input type="hidden" name="packageIndex" value={fromOffer.index} />
          <p className="rounded-md bg-muted/60 p-3 text-sm">
            Předvyplněno z uložených balíčků: <strong>{fromOffer.name}</strong>. Nabídka se po vytvoření označí
            jako přijatá.
          </p>
        </>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="clientId">Klient</Label>
          <NativeSelect
            id="clientId"
            name="clientId"
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setWebsiteId("");
            }}
            required
          >
            <option value="">Vyberte klienta…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="websiteId">Web</Label>
          <NativeSelect
            id="websiteId"
            name="websiteId"
            value={effectiveWebsite}
            onChange={(e) => setWebsiteId(e.target.value)}
          >
            {clientSites.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
                {w.domain ? ` (${w.domain})` : ""}
              </option>
            ))}
            <option value="new">+ Nový web</option>
          </NativeSelect>
        </div>
      </div>
      {effectiveWebsite === "new" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="newWebsiteName">Název nového webu</Label>
            <Input
              id="newWebsiteName"
              name="newWebsiteName"
              defaultValue={clientName}
              key={clientId}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="newWebsiteDomain">Doména</Label>
            <Input id="newWebsiteDomain" name="newWebsiteDomain" placeholder="firma.cz" />
          </div>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="tierId">Šablona balíčku</Label>
          <NativeSelect
            id="tierId"
            name="tierId"
            value={tierId}
            onChange={(e) => {
              setTierId(e.target.value);
              setUseOffer(false);
            }}
          >
            {tiers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
            <option value="">Vlastní (bez šablony)</option>
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="name">Název balíčku pro klienta</Label>
          <Input id="name" name="name" defaultValue={tier?.name ?? ""} key={`n-${tierId}-${useOffer}`} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="price">Cena (Kč / měsíc)</Label>
          <Input
            id="price"
            name="price"
            inputMode="decimal"
            defaultValue={tier ? String(tier.monthlyPriceHalere / 100) : ""}
            key={`p-${tierId}-${useOffer}`}
            required
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="features">Funkce (jedna na řádek)</Label>
        <Textarea
          id="features"
          name="features"
          rows={6}
          defaultValue={tier?.features.join("\n") ?? ""}
          key={`f-${tierId}-${useOffer}`}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="startedOn">Začátek předplatného</Label>
          <Input id="startedOn" name="startedOn" type="date" defaultValue={today} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="paidUntil">Zaplaceno do</Label>
          <Input id="paidUntil" name="paidUntil" type="date" defaultValue={dayBefore} required />
          <p className="text-xs text-muted-foreground">
            Den před začátkem = zatím nic nezaplaceno, první platba je splatná v den začátku.
          </p>
        </div>
      </div>
      <FormMessage state={state} />
      <div>
        <Button type="submit" disabled={pending || !clientId}>
          {pending ? "Vytvářím…" : "Vytvořit předplatné"}
        </Button>
      </div>
    </form>
  );
}
