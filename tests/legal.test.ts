import { describe, expect, it } from "vitest";
import {
  COMMERCIAL_LABEL,
  identityLine,
  isCommercialKind,
  leadRetentionDays,
  providerIdentity,
  withSenderFooter,
} from "@/lib/legal";
import { buildSitePrompt, UNCLEARED_MARK, type PromptInput } from "@/server/builder/prompt";
import { withUnsubscribe } from "@/server/email/render";
import { isPublicPath } from "@/lib/public-paths";

const ENV = { PROVIDER_NAME: "Jan Novák", PROVIDER_ICO: "12345678", PROVIDER_ADDRESS: "Hlavní 1, Brno" };

describe("sender identification", () => {
  it("reports missing env vars", () => {
    expect(providerIdentity({})).toEqual({
      ok: false,
      missing: ["PROVIDER_NAME", "PROVIDER_ICO", "PROVIDER_ADDRESS"],
    });
  });
  it("builds the § 435 line with the default register", () => {
    const id = providerIdentity(ENV);
    expect(id.ok).toBe(true);
    if (id.ok)
      expect(identityLine(id.identity)).toBe(
        "Jan Novák, IČO 12345678, se sídlem Hlavní 1, Brno, zapsán v živnostenském rejstříku.",
      );
  });
  it("adds the footer once, with the commercial label only for offers", () => {
    const id = providerIdentity(ENV);
    if (!id.ok) throw new Error();
    const body = withUnsubscribe("Dobrý den", "https://u/1");
    const offer = withSenderFooter(body, {
      identity: id.identity,
      privacyUrl: "https://a/ochrana-udaju",
      commercial: true,
    });
    expect(offer).toContain(COMMERCIAL_LABEL);
    expect(offer).toContain("IČO 12345678");
    expect(offer).toContain("https://a/ochrana-udaju");
    expect(offer.match(/---/g)).toHaveLength(1);
    expect(withSenderFooter(offer, { identity: id.identity, privacyUrl: "x", commercial: true })).toBe(offer);
    const reminder = withSenderFooter(body, { identity: id.identity, privacyUrl: "x", commercial: false });
    expect(reminder).not.toContain(COMMERCIAL_LABEL);
  });
  it("classifies offers as commercial", () => {
    expect(isCommercialKind("offer_l1")).toBe(true);
    expect(isCommercialKind("dunning_1")).toBe(false);
    expect(isCommercialKind(null)).toBe(false);
  });
  it("retention defaults to 180 days and has a floor", () => {
    expect(leadRetentionDays({})).toBe(180);
    expect(leadRetentionDays({ LEAD_RETENTION_DAYS: "90" })).toBe(90);
    expect(leadRetentionDays({ LEAD_RETENTION_DAYS: "5" })).toBe(180);
  });
  it("the privacy page is public", () => {
    expect(isPublicPath("/ochrana-udaju")).toBe(true);
  });
});

describe("builder prompt – rights and legal minimum", () => {
  const base: PromptInput = {
    projectName: "Web",
    clientInfo: { businessName: "Kadeřnictví Eva" },
    structure: { mode: "one-page", pages: [], sections: [], extras: [] },
    style: {},
    customInstructions: null,
    photos: [
      { url: "https://img/ok.jpg", isHero: true, rightsConfirmed: true },
      { url: "https://img/cizi.jpg", isHero: false },
    ],
    logoUrl: null,
    reviews: [{ author: "Eva", rating: 5, text: "Super", rightsConfirmed: false }],
    documents: [],
  };
  it("flags uncleared assets as demo-only", () => {
    const p = buildSitePrompt(base);
    expect(p).toContain(`Fotka 2: https://img/cizi.jpg${UNCLEARED_MARK}`);
    expect(p).not.toContain(`https://img/ok.jpg${UNCLEARED_MARK}`);
    expect(p).toContain("## Podklady s neověřenými právy");
    expect(p).toContain("noindex");
  });
  it("has no demo section when everything is cleared", () => {
    const p = buildSitePrompt({ ...base, photos: [base.photos[0]], reviews: [] });
    expect(p).not.toContain("## Podklady s neověřenými právy");
  });
  it("always includes the legal minimum, e-shop terms only for an e-shop", () => {
    const p = buildSitePrompt(base);
    expect(p).toContain("## Právní minimum webu");
    expect(p).toContain("IČO");
    expect(p).not.toContain("odstoupit od smlouvy");
    const shop = buildSitePrompt({ ...base, structure: { ...base.structure, extras: ["eshop"] } });
    expect(shop).toContain("odstoupit od smlouvy do 14 dnů");
  });
});
