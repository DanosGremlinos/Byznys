import "server-only";
import { and, asc, desc, eq, or } from "drizzle-orm";
import { SCORE_FACTOR_LABELS, type ScoreFactorKey } from "@/config/scoring";
import type { Database } from "@/db/client";
import {
  clients,
  contractTemplates,
  contracts,
  emailAttachments,
  emailTemplates,
  emailThreads,
  emails,
  leads,
  subscriptionTiers,
  websites,
} from "@/db/schema";
import type { ScoreFactorResult } from "@/db/schema/types";
import { formatCzk, formatDate, pragueToday } from "@/lib/format";
import { slugify } from "@/db/seed-data";
import { aiConfigured } from "@/server/ai/client";
import { personalizeDraft } from "@/server/ai/messaging";
import { isBlacklisted } from "@/server/email/blacklist";
import { displayNameOf, normalizeEmail, renderTemplate } from "@/server/email/render";

export type OfferLevel = "offer_l1" | "offer_l2" | "offer_l3";

export const LEVEL_LABELS: Record<string, string> = {
  offer_l1: "L1 – první nabídka",
  offer_l2: "L2 – návrh a smlouva",
  offer_l3: "L3 – předplatné",
  dunning_1: "Upomínka 1",
  dunning_2: "Upomínka 2",
  dunning_3: "Upomínka 3",
  reply: "Odpověď",
  custom: "Vlastní",
};

/** Customer-facing wording of the score factors (internal labels are too terse for an email). */
const ISSUE_TEXT: Record<ScoreFactorKey, (detail?: string) => string> = {
  noWebsite: () => "Na Google Mapách u vás chybí odkaz na web, takže vás noví zákazníci hůř najdou.",
  outdatedSite: (d) => `Web působí zastarale${d ? ` (${d})` : ""}.`,
  poorDesign: (d) => `Vzhled webu neodpovídá dnešním zvyklostem${d ? ` – ${d.toLowerCase()}` : ""}.`,
  notMobileFriendly: () => "Web se špatně zobrazuje na mobilu, odkud dnes přichází většina návštěvníků.",
  slow: (d) => `Web se načítá pomalu${d ? ` (${d})` : ""}.`,
  noHttps: () => "Web nemá zabezpečené připojení (HTTPS), takže ho prohlížeče označují jako nezabezpečený.",
  missingSeo: (d) => `Webu chybí základní údaje pro vyhledávače${d ? ` (${d.toLowerCase()})` : ""}.`,
  strongReputationWeakWeb: (d) =>
    `Máte skvělé hodnocení na Googlu${d ? ` – ${d.replace("Hodnocení ", "")}` : ""}, ale web to zatím neukazuje.`,
};

export function issuesText(factors: ScoreFactorResult[] | null | undefined): string {
  const lines = (factors ?? [])
    .filter((f) => f.fired && f.key in ISSUE_TEXT)
    .sort((a, b) => b.points - a.points)
    .slice(0, 4)
    .map((f) => `- ${ISSUE_TEXT[f.key as ScoreFactorKey](f.detail)}`);
  return lines.join("\n");
}

export function tierComparisonText(
  tiers: { name: string; monthlyPriceHalere: number; features: string[] }[],
): string {
  return tiers
    .map(
      (t) =>
        `${t.name} – ${formatCzk(t.monthlyPriceHalere).replace(/\s/g, " ")} měsíčně\n${t.features.map((f) => `  • ${f}`).join("\n")}`,
    )
    .join("\n\n");
}

export function senderName(): string {
  return displayNameOf(process.env.EMAIL_FROM ?? "Webové stránky <nabidky@example.cz>");
}

export function senderFrom(): string {
  return process.env.EMAIL_FROM ?? "Webové stránky <nabidky@example.cz>";
}

export type OfferInput = {
  leadId?: string | null;
  clientId?: string | null;
  level: OfferLevel;
  previewUrl?: string | null;
  screenshotUrl?: string | null;
  tierId?: string | null;
  priceHalere?: number | null;
  useAi: boolean;
};

export type OfferResult = { emailId: string; warnings: string[] };

/** Creates a client record from a lead (used when an L2 contract is prepared for a lead). */
export async function ensureClientForLead(db: Database, leadId: string) {
  const existing = await db.query.clients.findFirst({ where: eq(clients.leadId, leadId) });
  if (existing) return existing;
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, leadId) });
  if (!lead) throw new Error("Lead nenalezen");
  const [client] = await db
    .insert(clients)
    .values({
      businessName: lead.name,
      contactPerson: lead.contactPerson,
      email: lead.email,
      phone: lead.phone,
      address: lead.address,
      city: lead.city,
      leadId: lead.id,
    })
    .returning();
  return client;
}

/** Prepares an offer email (L1/L2/L3) and puts it into the approval queue. Never sends. */
export async function createOfferDraft(db: Database, input: OfferInput): Promise<OfferResult> {
  const warnings: string[] = [];
  let lead = input.leadId ? await db.query.leads.findFirst({ where: eq(leads.id, input.leadId) }) : undefined;
  let client = input.clientId
    ? await db.query.clients.findFirst({ where: eq(clients.id, input.clientId) })
    : undefined;
  if (!lead && !client) throw new Error("Vyberte lead nebo klienta.");
  if (client?.leadId && !lead) lead = await db.query.leads.findFirst({ where: eq(leads.id, client.leadId) });

  // L2 carries a contract, which belongs to a client: create the client from the lead if needed.
  if (input.level === "offer_l2" && !client && lead) {
    client = await ensureClientForLead(db, lead.id);
    warnings.push(`Z leadu byl vytvořen klient „${client.businessName}“ (kvůli smlouvě).`);
  }

  const toAddress = client?.email ?? lead?.email;
  if (!toAddress) throw new Error("Adresát nemá e-mailovou adresu.");
  if (await isBlacklisted(db, toAddress)) warnings.push("Adresa je na blacklistu – e-mail nepůjde odeslat.");

  const website = client
    ? await db.query.websites.findFirst({
        where: eq(websites.clientId, client.id),
        orderBy: desc(websites.updatedAt),
      })
    : undefined;
  const tiers = await db.query.subscriptionTiers.findMany({
    where: eq(subscriptionTiers.isActive, true),
    orderBy: asc(subscriptionTiers.sortOrder),
  });
  const tier = tiers.find((t) => t.id === input.tierId) ?? tiers[1] ?? tiers[0];
  const priceHalere = input.priceHalere ?? tier?.monthlyPriceHalere ?? null;
  const businessName = client?.businessName ?? lead!.name;
  const previewUrl = input.previewUrl || website?.previewUrl || null;

  const template =
    (await db.query.emailTemplates.findFirst({ where: eq(emailTemplates.key, `${input.level}_default`) })) ??
    (await db.query.emailTemplates.findFirst({
      where: eq(emailTemplates.kind, input.level),
      orderBy: asc(emailTemplates.createdAt),
    }));
  if (!template) throw new Error("Pro tuto úroveň chybí šablona e-mailu.");

  const vars: Record<string, string | null> = {
    businessName,
    contactGreeting: "",
    contactName: client?.contactPerson ?? lead?.contactPerson ?? null,
    issues: issuesText(lead?.scoreFactors) || "- Současná online prezentace nevyužívá svůj potenciál.",
    previewUrl,
    senderName: senderName(),
    packageName: tier?.name ?? null,
    tierName: tier?.name ?? null,
    monthlyPrice: priceHalere !== null ? formatCzk(priceHalere).replace(/\s/g, " ") : null,
    tierComparison: tierComparisonText(tiers),
    websiteDomain: website?.domain ?? null,
  };
  let subject = renderTemplate(template.subject, vars);
  let body = renderTemplate(template.body, vars);

  if (input.useAi) {
    if (!aiConfigured())
      warnings.push("AI není nastavená (ANTHROPIC_API_KEY) – použita šablona bez personalizace.");
    else {
      try {
        const facts = {
          firma: businessName,
          obor: lead?.category,
          město: lead?.city ?? client?.city,
          kontaktní_osoba: vars.contactName,
          hodnocení_google: lead?.rating ? `${lead.rating} (${lead.reviewCount} recenzí)` : null,
          současný_web: lead?.websiteUrl ?? null,
          zjištěné_problémy: (lead?.scoreFactors ?? [])
            .filter((f) => f.fired)
            .map(
              (f) =>
                `${SCORE_FACTOR_LABELS[f.key as ScoreFactorKey] ?? f.key}${f.detail ? `: ${f.detail}` : ""}`,
            ),
          náhled_nového_webu: previewUrl,
          navržený_balíček: tier
            ? { název: tier.name, cena_měsíčně: vars.monthlyPrice, funkce: tier.features }
            : null,
        };
        const ai = await personalizeDraft({ level: LEVEL_LABELS[input.level], subject, body, facts });
        subject = ai.subject;
        body = ai.body;
      } catch (err) {
        warnings.push(`AI návrh selhal (${err instanceof Error ? err.message : "chyba"}) – použita šablona.`);
      }
    }
  }

  // Continue the existing conversation with this contact, or start a new one.
  const contactFilter = [
    ...(client ? [eq(emailThreads.clientId, client.id)] : []),
    ...(lead ? [eq(emailThreads.leadId, lead.id)] : []),
  ];
  let thread = await db.query.emailThreads.findFirst({
    where: or(...contactFilter),
    orderBy: desc(emailThreads.lastMessageAt),
  });
  if (!thread) {
    [thread] = await db
      .insert(emailThreads)
      .values({ clientId: client?.id ?? null, leadId: lead?.id ?? null, subject })
      .returning();
  } else if (client && !thread.clientId) {
    await db.update(emailThreads).set({ clientId: client.id }).where(eq(emailThreads.id, thread.id));
  }

  const [email] = await db
    .insert(emails)
    .values({
      threadId: thread.id,
      direction: "outbound",
      status: "pending_approval",
      kind: input.level,
      templateId: template.id,
      fromAddress: senderFrom(),
      toAddress: normalizeEmail(toAddress),
      subject,
      bodyText: body,
    })
    .returning();

  if (input.screenshotUrl) {
    await db.insert(emailAttachments).values({
      emailId: email.id,
      url: input.screenshotUrl,
      filename: "nahled-webu",
      contentType: "image/png",
    });
  }

  if (input.level === "offer_l2" && client) {
    const contractTemplate =
      (await db.query.contractTemplates.findFirst({ where: eq(contractTemplates.isDefault, true) })) ??
      (await db.query.contractTemplates.findFirst());
    if (!contractTemplate) warnings.push("Chybí šablona smlouvy – smlouva nebyla přiložena.");
    else {
      const contractBody = renderTemplate(contractTemplate.body, {
        providerName: process.env.PROVIDER_NAME ?? senderName(),
        providerIco: process.env.PROVIDER_ICO ?? null,
        providerAddress: process.env.PROVIDER_ADDRESS ?? null,
        clientName: client.businessName,
        clientIco: client.ico,
        clientAddress: client.address,
        domain: website?.domain ?? null,
        monthlyPrice: vars.monthlyPrice,
        packageName: tier?.name ?? null,
        tierName: tier?.name ?? null,
        city: process.env.PROVIDER_CITY ?? client.city,
        date: formatDate(pragueToday()),
      });
      const [contract] = await db
        .insert(contracts)
        .values({
          clientId: client.id,
          websiteId: website?.id ?? null,
          templateId: contractTemplate.id,
          title: `Smlouva – ${client.businessName}`,
          body: contractBody,
        })
        .returning();
      await db.insert(emailAttachments).values({
        emailId: email.id,
        url: `/api/contracts/${contract.id}/pdf`,
        filename: `smlouva-${slugify(client.businessName)}.pdf`,
        contentType: "application/pdf",
      });
    }
  }
  return { emailId: email.id, warnings };
}

/** A reply draft in an existing thread (body written by the owner or suggested by AI). */
export async function createReplyDraft(db: Database, threadId: string, body: string) {
  const thread = await db.query.emailThreads.findFirst({ where: eq(emailThreads.id, threadId) });
  if (!thread) throw new Error("Vlákno nenalezeno");
  const lastInbound = await db.query.emails.findFirst({
    where: and(eq(emails.threadId, threadId), eq(emails.direction, "inbound")),
    orderBy: desc(emails.createdAt),
  });
  const lastAny = await db.query.emails.findFirst({
    where: eq(emails.threadId, threadId),
    orderBy: desc(emails.createdAt),
  });
  const to = lastInbound?.fromAddress ?? lastAny?.toAddress;
  if (!to) throw new Error("Nelze určit adresáta.");
  const [email] = await db
    .insert(emails)
    .values({
      threadId,
      direction: "outbound",
      status: "pending_approval",
      kind: "reply",
      fromAddress: senderFrom(),
      toAddress: normalizeEmail(to.match(/<([^>]+)>/)?.[1] ?? to),
      subject: thread.subject.startsWith("Re:") ? thread.subject : `Re: ${thread.subject}`,
      bodyText: body,
      inReplyTo: lastInbound?.messageIdHeader ?? null,
    })
    .returning();
  return email;
}
