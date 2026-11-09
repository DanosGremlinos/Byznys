"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { composeOffer, type ActionState } from "../../actions";

type Option = { id: string; name: string; email: string | null; blacklisted: boolean };
type Props = {
  leads: (Option & { status: string; score: number | null; city: string | null })[];
  clients: (Option & { previewUrl: string | null })[];
  tiers: { id: string; name: string; monthlyPriceHalere: number }[];
  packageOffers: { id: string; clientId: string; leadId: string | null; clientName: string; label: string }[];
  initialOfferId: string;
  initialRecipient: string;
  aiEnabled: boolean;
};

const LEVELS = [
  {
    key: "offer_l1",
    title: "L1 – první nabídka",
    text: "Oslovení s odkazem nebo screenshotem připraveného návrhu a konkrétními problémy jejich webu.",
  },
  {
    key: "offer_l2",
    title: "L2 – návrh + smlouva",
    text: "Finální návrh a pevná jednorázová cena za web. Smlouvu k podpisu přiložíte jako soubor. Založí zakázku.",
  },
  {
    key: "offer_budget",
    title: "Dotaz na rozpočet",
    text: "Zeptá se klienta, kolik je ochoten měsíčně platit za správu webu. Z odpovědi kalkulačka v Tarifech složí 3 balíčky správy.",
  },
  {
    key: "offer_l3",
    title: "L3 – správa webu",
    text: "Nabídka měsíční správy webu se srovnáním 3 balíčků z kalkulačky (bez platebního odkazu).",
  },
] as const;

export function ComposeForm({
  leads,
  clients,
  tiers,
  packageOffers,
  initialOfferId,
  initialRecipient,
  aiEnabled,
}: Props) {
  const [state, action, pending] = useActionState<ActionState, FormData>(composeOffer, {});
  const [recipient, setRecipient] = useState(initialRecipient);
  const [level, setLevel] = useState<(typeof LEVELS)[number]["key"]>(initialOfferId ? "offer_l3" : "offer_l1");
  // Saved packages of the selected client (or of the client made from the selected lead) come first.
  const isRecipients = (o: Props["packageOffers"][number]) =>
    `client:${o.clientId}` === recipient || (o.leadId !== null && `lead:${o.leadId}` === recipient);
  const clientOffers = packageOffers.filter(isRecipients);
  const otherOffers = packageOffers.filter((o) => !isRecipients(o));
  const [offerId, setOfferId] = useState<string | null>(initialOfferId || null);
  const effectiveOffer =
    offerId !== null && (offerId === "" || packageOffers.some((o) => o.id === offerId))
      ? offerId
      : (clientOffers[0]?.id ?? "");
  const [tierId, setTierId] = useState(tiers[1]?.id ?? tiers[0]?.id ?? "");
  const tier = tiers.find((t) => t.id === tierId);
  const client = recipient.startsWith("client:")
    ? clients.find((c) => `client:${c.id}` === recipient)
    : undefined;
  const selected = [
    ...leads.map((l) => ({ ...l, key: `lead:${l.id}` })),
    ...clients.map((c) => ({ ...c, key: `client:${c.id}` })),
  ].find((x) => x.key === recipient);

  return (
    <form action={action} className="grid max-w-3xl grid-cols-1 gap-6">
      <div className="grid grid-cols-1 gap-1.5">
        <Label htmlFor="recipient">Adresát</Label>
        <NativeSelect
          id="recipient"
          name="recipient"
          value={recipient}
          onChange={(e) => {
            setRecipient(e.target.value);
            setOfferId(null);
          }}
          required
        >
          <option value="">Vyberte lead nebo klienta…</option>
          <optgroup label="Klienti">
            {clients.map((c) => (
              <option key={c.id} value={`client:${c.id}`}>
                {c.name} – {c.email}
                {c.blacklisted ? " (blacklist)" : ""}
              </option>
            ))}
          </optgroup>
          <optgroup label="Leady (podle skóre)">
            {leads.map((l) => (
              <option key={l.id} value={`lead:${l.id}`}>
                {l.score ?? "–"} · {l.name}
                {l.city ? `, ${l.city}` : ""} – {l.email}
                {l.blacklisted ? " (blacklist)" : ""}
              </option>
            ))}
          </optgroup>
        </NativeSelect>
        {selected?.blacklisted ? (
          <p className="text-sm text-destructive">Tato adresa je na blacklistu – e-mail nepůjde odeslat.</p>
        ) : null}
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Úroveň nabídky</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {LEVELS.map((l) => (
            <label
              key={l.key}
              className={`cursor-pointer rounded-md border p-3 text-sm ${level === l.key ? "border-primary ring-2 ring-primary" : ""}`}
            >
              <input
                type="radio"
                name="level"
                value={l.key}
                checked={level === l.key}
                onChange={() => setLevel(l.key)}
                className="sr-only"
              />
              <div className="font-medium">{l.title}</div>
              <div className="text-xs text-muted-foreground">{l.text}</div>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid grid-cols-1 gap-1.5">
          <Label htmlFor="previewUrl">Odkaz na náhled návrhu</Label>
          <Input
            id="previewUrl"
            name="previewUrl"
            type="url"
            placeholder="https://…vercel.app"
            defaultValue={client?.previewUrl ?? ""}
            key={client?.id ?? "none"}
          />
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          <Label htmlFor="screenshotUrl">Screenshot návrhu (URL obrázku, volitelné)</Label>
          <Input id="screenshotUrl" name="screenshotUrl" type="url" placeholder="https://…/nahled.png" />
        </div>
      </div>

      {level === "offer_l3" ? (
        <div className="grid grid-cols-1 gap-1.5">
          <Label htmlFor="packageOfferId">Balíčky z kalkulačky</Label>
          <NativeSelect
            id="packageOfferId"
            name="packageOfferId"
            value={effectiveOffer}
            onChange={(e) => setOfferId(e.target.value)}
          >
            {clientOffers.length ? (
              <optgroup label="Spočítané pro tohoto adresáta">
                {clientOffers.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            ) : null}
            <option value="">Obecné šablony (bez kalkulačky)</option>
            {otherOffers.length ? (
              <optgroup label="Spočítané pro jiné klienty (zkopírují se k tomuto adresátovi)">
                {otherOffers.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.clientName}: {o.label}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </NativeSelect>
          {recipient && !clientOffers.length ? (
            <p className="text-xs text-muted-foreground">
              Pro tohoto klienta zatím nejsou uložené balíčky –{" "}
              <Link className="underline" href={client ? `/settings/tiers?client=${client.id}` : "/settings/tiers"}>
                spočítat v kalkulačce
              </Link>
              .
            </p>
          ) : null}
        </div>
      ) : null}

      {level === "offer_l2" ? (
        <div className="grid gap-3">
          <div className="grid max-w-xs grid-cols-1 gap-1.5">
            <Label htmlFor="webPrice">Cena za vytvoření webu (Kč, jednorázově)</Label>
            <Input id="webPrice" name="webPrice" inputMode="decimal" placeholder="např. 4990" required />
          </div>
          <p className="text-xs text-muted-foreground">
            Smlouvu k podpisu nahrajete jako přílohu (PDF/Word) v dalším kroku ve frontě ke schválení – do textu
            e-mailu se nevkládá. Měsíční správu nabídnete později (Dotaz na rozpočet → L3).
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="generateContract" />
            Přiložit i smlouvu vygenerovanou ze šablony (místo vlastního souboru)
          </label>
        </div>
      ) : null}

      {level === "offer_l3" && !effectiveOffer ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid grid-cols-1 gap-1.5">
            <Label htmlFor="tierId">Doporučený balíček správy (šablona)</Label>
            <NativeSelect
              id="tierId"
              name="tierId"
              value={tierId}
              onChange={(e) => setTierId(e.target.value)}
            >
              {tiers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} – {(t.monthlyPriceHalere / 100).toLocaleString("cs-CZ")} Kč
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            <Label htmlFor="price">Měsíční cena pro tohoto klienta (Kč)</Label>
            <Input
              id="price"
              name="price"
              inputMode="decimal"
              placeholder={tier ? String(tier.monthlyPriceHalere / 100) : ""}
              key={tierId}
            />
          </div>
        </div>
      ) : null}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="useAi" defaultChecked={aiEnabled} disabled={!aiEnabled} />
        <Sparkles className="size-4" />
        Personalizovat text pomocí AI{" "}
        {aiEnabled ? "" : "(není nastaven ANTHROPIC_API_KEY – použije se šablona)"}
      </label>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <div>
        <Button type="submit" disabled={pending || !recipient}>
          {pending ? "Připravuji návrh…" : "Připravit návrh do fronty ke schválení"}
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          Nic se neodešle – e-mail se objeví ve frontě „Ke schválení“, kde ho zkontrolujete a odešlete.
        </p>
      </div>
    </form>
  );
}
