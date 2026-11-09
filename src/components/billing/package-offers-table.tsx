import { Mail, Plus } from "lucide-react";
import Link from "next/link";
import { deletePackageOfferAction } from "@/app/(app)/settings/tiers/actions";
import { ConfirmAction } from "@/components/common/confirm-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCzk, formatDate } from "@/lib/format";
import type { listPackageOffers } from "@/server/billing/package-offers";

type Offer = Awaited<ReturnType<typeof listPackageOffers>>[number];

function OfferStatus({ o }: { o: Offer }) {
  if (o.subscription) {
    const chosen = o.chosenIndex !== null ? o.packages[o.chosenIndex] : undefined;
    return (
      <Badge variant="secondary">
        Předplatné: {chosen?.name ?? o.subscription.name}
        {chosen?.recommended ? " ★" : ""}
      </Badge>
    );
  }
  if (o.email?.status === "sent") return <Badge variant="outline">L3 odesláno</Badge>;
  if (o.email) return <Badge variant="outline">L3 ve frontě</Badge>;
  return <Badge variant="outline">Spočítáno</Badge>;
}

/** Saved package offers ("popcorn" calculations) with their outcome and next actions. */
export function PackageOffersTable({ offers, showClient = true }: { offers: Offer[]; showClient?: boolean }) {
  if (!offers.length)
    return <p className="text-sm text-muted-foreground">Zatím žádné uložené balíčky.</p>;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Datum</TableHead>
            {showClient ? <TableHead>Klient / zakázka</TableHead> : null}
            <TableHead className="text-right">Rozpočet</TableHead>
            <TableHead>Balíčky</TableHead>
            <TableHead>Stav</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {offers.map((o) => (
            <TableRow key={o.id}>
              <TableCell className="whitespace-nowrap">{formatDate(o.createdAt)}</TableCell>
              {showClient ? (
                <TableCell>
                  <div className="font-medium">{o.client.businessName}</div>
                  {o.website ? (
                    <Link href={`/websites/${o.website.id}`} className="text-xs text-muted-foreground underline">
                      {o.website.domain ?? o.website.name}
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground">bez zakázky</span>
                  )}
                </TableCell>
              ) : null}
              <TableCell className="text-right tabular-nums">{formatCzk(o.budgetHalere)}</TableCell>
              <TableCell className="whitespace-nowrap text-sm tabular-nums">
                {o.packages.map((p, i) => (
                  <span key={i} className={p.recommended ? "font-semibold" : undefined}>
                    {i ? " / " : ""}
                    {p.name} {formatCzk(p.priceHalere)}
                    {p.recommended ? " ★" : ""}
                  </span>
                ))}
                {o.note ? <div className="text-xs text-muted-foreground">{o.note}</div> : null}
              </TableCell>
              <TableCell>
                <OfferStatus o={o} />
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap items-start justify-end gap-1">
                {o.subscription ? (
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/subscriptions/${o.subscription.id}`}>Předplatné</Link>
                  </Button>
                ) : (
                  <>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/messaging/queue/new?client=${o.client.id}&offer=${o.id}`}>
                        <Mail />
                        E-mail L3
                      </Link>
                    </Button>
                    {o.packages.map((p, i) => (
                      <Button key={i} asChild size="sm" variant={p.recommended ? "default" : "ghost"}>
                        <Link href={`/subscriptions/new?client=${o.client.id}&offer=${o.id}&pkg=${i}`}>
                          <Plus />
                          {p.name}
                        </Link>
                      </Button>
                    ))}
                  </>
                )}
                <ConfirmAction
                  action={deletePackageOfferAction.bind(null, o.id)}
                  confirmText={`Smazat uložené balíčky z ${formatDate(o.createdAt)}${showClient ? ` (${o.client.businessName})` : ""}?${o.subscription ? " Předplatné, které z nich vzniklo, zůstane." : ""}`}
                  label="Smazat balíčky"
                  variant="ghost"
                  size="icon-sm"
                  iconOnly
                />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
