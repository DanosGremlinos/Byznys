"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/billing/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { createSubscriptionAction, type FormState } from "../actions";

type SavedOffer = {
  id: string;
  clientId: string;
  clientName: string;
  websiteId: string | null;
  label: string;
  packages: { tierId: string | null; name: string; priceHalere: number; features: string[]; recommended: boolean }[];
};

type Props = {
  clients: { id: string; name: string }[];
  websites: { id: string; clientId: string; name: string; domain: string | null }[];
  tiers: { id: string; name: string; monthlyPriceHalere: number; features: string[] }[];
  /** Saved calculator packages (all clients; the selected client's are listed first). */
  offers: SavedOffer[];
  initialClientId: string;
  initialWebsiteId: string;
  /** "offer:<offerId>:<index>" to preselect a saved package. */
  initialPackage: string;
  today: string;
  dayBefore: string;
};

const czk = (halere: number) => `${(halere / 100).toLocaleString("cs-CZ")} Kč`;

function offerOptions(offer: SavedOffer, withClient: boolean) {
  return offer.packages.map((p, i) => (
    <option key={`${offer.id}-${i}`} value={`offer:${offer.id}:${i}`}>
      {p.recommended ? "★ " : ""}
      {p.name} – {czk(p.priceHalere)} / měsíc · {withClient ? `${offer.clientName}, ` : ""}
      {offer.label}
    </option>
  ));
}

export function NewSubscriptionForm({
  clients,
  websites,
  tiers,
  offers,
  initialClientId,
  initialWebsiteId,
  initialPackage,
  today,
  dayBefore,
}: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(createSubscriptionAction, {});
  const [clientId, setClientId] = useState(initialClientId);
  const clientSites = websites.filter((w) => w.clientId === clientId);
  const [websiteId, setWebsiteId] = useState<string>(initialWebsiteId);
  const effectiveWebsite =
    websiteId === "new" || clientSites.some((w) => w.id === websiteId) ? websiteId : (clientSites[0]?.id ?? "new");
  const clientOffers = offers.filter((o) => o.clientId === clientId);
  const otherOffers = offers.filter((o) => o.clientId !== clientId);
  // Default: the recommended package of the client's newest saved offer, otherwise the first template.
  const defaultChoice = (cid: string) => {
    const o = offers.find((x) => x.clientId === cid);
    if (o) return `offer:${o.id}:${Math.max(0, o.packages.findIndex((p) => p.recommended))}`;
    return tiers[0] ? `tier:${tiers[0].id}` : "custom";
  };
  const [choice, setChoice] = useState(initialPackage || defaultChoice(initialClientId));

  const [kind, refId, idx] = choice.split(":");
  const offer = kind === "offer" ? offers.find((o) => o.id === refId) : undefined;
  const offerPkg = offer?.packages[Number(idx)];
  const template = kind === "tier" ? tiers.find((t) => t.id === refId) : undefined;
  const pkg = offerPkg
    ? { name: offerPkg.name, monthlyPriceHalere: offerPkg.priceHalere, features: offerPkg.features }
    : template;
  const tierId = offerPkg ? (offerPkg.tierId ?? "") : (template?.id ?? "");
  const clientName = clients.find((c) => c.id === clientId)?.name ?? "";

  return (
    <form action={action} className="grid max-w-3xl gap-5">
      <input type="hidden" name="tierId" value={tierId} />
      {offer && offerPkg && offer.clientId === clientId ? (
        <>
          <input type="hidden" name="packageOfferId" value={offer.id} />
          <input type="hidden" name="packageIndex" value={idx} />
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
              setChoice(defaultChoice(e.target.value));
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
      <div className="grid gap-1.5">
        <Label htmlFor="package">Balíček</Label>
        <NativeSelect id="package" value={choice} onChange={(e) => setChoice(e.target.value)}>
          {clientOffers.map((o) => (
            <optgroup key={o.id} label={`Spočítané pro ${o.clientName} (${o.label})`}>
              {offerOptions(o, false)}
            </optgroup>
          ))}
          <optgroup label="Šablony balíčků">
            {tiers.map((t) => (
              <option key={t.id} value={`tier:${t.id}`}>
                {t.name} – {czk(t.monthlyPriceHalere)} / měsíc
              </option>
            ))}
            <option value="custom">Vlastní (bez šablony)</option>
          </optgroup>
          {otherOffers.length ? (
            <optgroup label="Spočítané pro jiné klienty">
              {otherOffers.map((o) => offerOptions(o, true))}
            </optgroup>
          ) : null}
        </NativeSelect>
        <p className="text-xs text-muted-foreground">
          {offer && offer.clientId === clientId
            ? "Balíček z kalkulačky – uložená nabídka se po vytvoření označí jako přijatá."
            : clientId && !clientOffers.length
              ? "Pro tohoto klienta zatím nejsou uložené balíčky z kalkulačky (Tarify)."
              : "Název, cenu i obsah můžete níže upravit jen pro tohoto klienta."}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="name">Název balíčku pro klienta</Label>
          <Input id="name" name="name" defaultValue={pkg?.name ?? ""} key={`n-${choice}`} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="price">Cena správy (Kč / měsíc)</Label>
          <Input
            id="price"
            name="price"
            inputMode="decimal"
            defaultValue={pkg ? String(pkg.monthlyPriceHalere / 100) : ""}
            key={`p-${choice}`}
            required
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="features">Co správa obsahuje (jedna věc na řádek)</Label>
        <Textarea
          id="features"
          name="features"
          rows={6}
          defaultValue={pkg?.features.join("\n") ?? ""}
          key={`f-${choice}`}
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
