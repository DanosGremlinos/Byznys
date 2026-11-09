// Legal identity of the business and the footer every outgoing email carries. Pure functions (unit tested).
//
// - § 435 občanského zákoníku: business correspondence states name, IČO, registered address and the
//   register entry.
// - § 7 zák. č. 480/2004 Sb.: a commercial email is clearly marked as such, names the sender and
//   offers a free way to opt out.

export type ProviderIdentity = {
  name: string;
  ico: string;
  address: string;
  /** e.g. "zapsán v živnostenském rejstříku" */
  register: string;
};

type Env = Record<string, string | undefined>;

export const IDENTITY_ENV = ["PROVIDER_NAME", "PROVIDER_ICO", "PROVIDER_ADDRESS"] as const;

export const DEFAULT_REGISTER = "zapsán v živnostenském rejstříku";

/** The identity from env vars, or the list of missing variables. */
export function providerIdentity(
  env: Env = process.env,
): { ok: true; identity: ProviderIdentity } | { ok: false; missing: string[] } {
  const missing = IDENTITY_ENV.filter((k) => !env[k]?.trim());
  if (missing.length) return { ok: false, missing: [...missing] };
  return {
    ok: true,
    identity: {
      name: env.PROVIDER_NAME!.trim(),
      ico: env.PROVIDER_ICO!.trim(),
      address: env.PROVIDER_ADDRESS!.trim(),
      register: env.PROVIDER_REGISTER?.trim() || DEFAULT_REGISTER,
    },
  };
}

export function identityLine(id: ProviderIdentity): string {
  return `${id.name}, IČO ${id.ico}, se sídlem ${id.address}, ${id.register}.`;
}

export const COMMERCIAL_LABEL = "Toto je obchodní sdělení.";

/** Appends the sender identification (and, for offers, the commercial-communication label). */
export function withSenderFooter(
  body: string,
  opts: { identity: ProviderIdentity; privacyUrl: string; commercial: boolean },
): string {
  const line = identityLine(opts.identity);
  if (body.includes(line)) return body;
  const footer = [
    opts.commercial ? COMMERCIAL_LABEL : null,
    `Odesílatel: ${line}`,
    `Jak zpracovávám osobní údaje: ${opts.privacyUrl}`,
  ].filter(Boolean);
  const hasSeparator = /\n---\n/.test(body);
  return `${body.trimEnd()}\n${hasSeparator ? "" : "\n---\n"}${footer.join("\n")}\n`;
}

/** Offer emails are commercial communications that need the recipient's prior consent. */
export function isCommercialKind(kind: string | null | undefined): boolean {
  return Boolean(kind?.startsWith("offer_"));
}

/** Days after which an untouched lead without consent is erased (GDPR storage limitation). */
export function leadRetentionDays(env: Env = process.env): number {
  const n = Number(env.LEAD_RETENTION_DAYS);
  return Number.isFinite(n) && n >= 30 ? Math.floor(n) : 180;
}
