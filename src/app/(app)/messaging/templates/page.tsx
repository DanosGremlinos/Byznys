import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LEVEL_LABELS } from "@/server/messaging/compose";
import { listTemplates } from "@/server/messaging/queries";
import { createCustomTemplate } from "../actions";
import { ContractTemplateForm, EmailTemplateForm } from "./forms";

export const metadata: Metadata = { title: "Šablony" };

const VARIABLES: [string, string][] = [
  ["{{businessName}}", "název firmy klienta / leadu"],
  ["{{contactGreeting}}", "oslovení (doplní AI, jinak prázdné)"],
  ["{{issues}}", "konkrétní problémy současného webu (odrážky ze skóre)"],
  ["{{previewUrl}}", "odkaz na náhled návrhu"],
  ["{{packageName}} / {{monthlyPrice}}", "navržený balíček a měsíční cena"],
  ["{{tierComparison}}", "srovnání balíčků (z kalkulačky v Tarifech, jinak šablony tarifů)"],
  ["{{websiteDomain}}", "doména webu klienta"],
  ["{{senderName}}", "vaše jméno z EMAIL_FROM"],
  ["{{unsubscribeUrl}}", "odkaz pro odhlášení – doplní se vždy (když chybí, přidá se patička)"],
  ["{{amount}}, {{dueDate}}, {{daysOverdue}}", "upomínky (fáze 3)"],
];

const CONTRACT_VARIABLES =
  "{{providerName}}, {{providerIco}}, {{providerAddress}}, {{clientName}}, {{clientIco}}, {{clientAddress}}, {{domain}}, {{packageName}}, {{monthlyPrice}}, {{city}}, {{date}}";

export default function TemplatesPage() {
  return (
    <>
      <PageHeader
        title="Šablony"
        description="Šablony e-mailů L1–L3, dotazu na rozpočet, upomínek a smlouvy. AI z nich vychází a doplní je o data klienta."
        actions={
          <form action={createCustomTemplate}>
            <Button type="submit" variant="outline">
              <Plus />
              Nová šablona
            </Button>
          </form>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Proměnné</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {VARIABLES.map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="font-mono text-xs">{k}</dt>
                <dd className="text-muted-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Templates />
      </Suspense>
    </>
  );
}

async function Templates() {
  const { mail, contract } = await listTemplates();
  return (
    <>
      {mail.map((t) => (
        <Card key={t.id}>
          <CardHeader className="flex flex-row items-center gap-2">
            <CardTitle>{t.name}</CardTitle>
            <Badge variant="outline">{LEVEL_LABELS[t.kind] ?? t.kind}</Badge>
          </CardHeader>
          <CardContent>
            <EmailTemplateForm
              t={{ id: t.id, name: t.name, subject: t.subject, body: t.body, kind: t.kind }}
            />
          </CardContent>
        </Card>
      ))}
      {contract.map((t) => (
        <Card key={t.id}>
          <CardHeader className="flex flex-row items-center gap-2">
            <CardTitle>{t.name}</CardTitle>
            <Badge variant="outline">Smlouva{t.isDefault ? " · výchozí" : ""}</Badge>
          </CardHeader>
          <CardContent className="grid gap-2">
            <p className="text-xs text-muted-foreground">Proměnné: {CONTRACT_VARIABLES}</p>
            <ContractTemplateForm t={{ id: t.id, name: t.name, body: t.body }} />
          </CardContent>
        </Card>
      ))}
    </>
  );
}
