import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseContract, renderContractPdf } from "@/server/contracts/pdf";
import { parseMessageIds, verifyMailgunSignature } from "@/server/email/mailgun";
import { headerOf, verifyResendSignature } from "@/server/email/resend";
import {
  addressOf,
  createUnsubscribeToken,
  displayNameOf,
  renderTemplate,
  textToHtml,
  unresolvedPlaceholders,
  verifyUnsubscribeToken,
  withUnsubscribe,
} from "@/server/email/render";
import { issuesText, tierComparisonText } from "@/server/messaging/compose";

describe("templates", () => {
  it("fills known variables and keeps unknown ones detectable", () => {
    const out = renderTemplate(
      "Dobrý den{{contactGreeting}}, {{businessName}} – {{previewUrl}} {{unsubscribeUrl}}",
      {
        contactGreeting: "",
        businessName: "Pizza Bella",
        previewUrl: null,
      },
    );
    expect(out).toBe("Dobrý den, Pizza Bella – {{previewUrl}} {{unsubscribeUrl}}");
    expect(unresolvedPlaceholders(out)).toEqual(["previewUrl"]);
  });

  it("parses addresses", () => {
    expect(addressOf("Jan Novák <Jan@Firma.CZ>")).toBe("jan@firma.cz");
    expect(addressOf(" info@firma.cz ")).toBe("info@firma.cz");
    expect(displayNameOf('"Weby Brno" <a@b.cz>')).toBe("Weby Brno");
  });
});

describe("unsubscribe", () => {
  const secret = "s3cret";
  it("round-trips a signed token and rejects forgeries", () => {
    const token = createUnsubscribeToken("Info@Pizza.cz", secret);
    expect(verifyUnsubscribeToken(token, secret)).toBe("info@pizza.cz");
    expect(verifyUnsubscribeToken(token, "other")).toBeNull();
    const [, sig] = token.split(".");
    const forged = `${Buffer.from("victim@x.cz").toString("base64url")}.${sig}`;
    expect(verifyUnsubscribeToken(forged, secret)).toBeNull();
    expect(verifyUnsubscribeToken("garbage", secret)).toBeNull();
  });

  it("always ends up with the unsubscribe link in the body", () => {
    expect(withUnsubscribe("Text\n\nOdhlásit: {{unsubscribeUrl}}", "https://u/1")).toBe(
      "Text\n\nOdhlásit: https://u/1",
    );
    const appended = withUnsubscribe("Text bez patičky", "https://u/1");
    expect(appended).toContain("https://u/1");
    expect(appended).toContain("Odhlásit se můžete zde");
  });

  it("escapes HTML and links URLs", () => {
    const html = textToHtml("Ahoj <b>\n\nhttps://x.cz/a?b=1", { imageUrl: "https://img/x.png" });
    expect(html).toContain("Ahoj &lt;b&gt;");
    expect(html).toContain('<a href="https://x.cz/a?b=1"');
    expect(html).toContain('<img src="https://img/x.png"');
  });
});

describe("Mailgun webhook signature", () => {
  const key = "key-123";
  const ts = "1793500000";
  const token = "abc";
  const signature = createHmac("sha256", key)
    .update(ts + token)
    .digest("hex");
  const now = Number(ts) * 1000 + 60_000;
  it("accepts a valid, fresh signature", () => {
    expect(verifyMailgunSignature(key, { timestamp: ts, token, signature }, now)).toBe(true);
  });
  it("rejects wrong key, tampered token and stale timestamps", () => {
    expect(verifyMailgunSignature("other", { timestamp: ts, token, signature }, now)).toBe(false);
    expect(verifyMailgunSignature(key, { timestamp: ts, token: "abd", signature }, now)).toBe(false);
    expect(verifyMailgunSignature(key, { timestamp: ts, token, signature }, now + 3_600_000)).toBe(false);
    expect(verifyMailgunSignature("", { timestamp: ts, token, signature }, now)).toBe(false);
  });
  it("parses References headers", () => {
    expect(parseMessageIds("<a@x> <b@y>\n <c@z>")).toEqual(["<a@x>", "<b@y>", "<c@z>"]);
    expect(parseMessageIds(null)).toEqual([]);
  });
});

describe("resend webhook signature", () => {
  const rawKey = Buffer.from("super-secret-test-key-0123456789");
  const secret = `whsec_${rawKey.toString("base64")}`;
  const id = "msg_2abc";
  const ts = "1793900000";
  const body = '{"type":"email.received","data":{"email_id":"e1"}}';
  const sig = createHmac("sha256", rawKey).update(`${id}.${ts}.${body}`).digest("base64");
  const now = Number(ts) * 1000 + 30_000;
  it("accepts a valid signature, also among several (key rotation)", () => {
    expect(verifyResendSignature(secret, { id, timestamp: ts, signature: `v1,${sig}` }, body, now)).toBe(true);
    expect(
      verifyResendSignature(secret, { id, timestamp: ts, signature: `v1,AAAA v1,${sig}` }, body, now),
    ).toBe(true);
  });
  it("rejects tampered body, wrong secret, stale timestamp and missing headers", () => {
    const h = { id, timestamp: ts, signature: `v1,${sig}` };
    expect(verifyResendSignature(secret, h, body + " ", now)).toBe(false);
    expect(verifyResendSignature("whsec_b3RoZXI=", h, body, now)).toBe(false);
    expect(verifyResendSignature(secret, h, body, now + 3_600_000)).toBe(false);
    expect(verifyResendSignature(secret, { ...h, signature: null }, body, now)).toBe(false);
    expect(verifyResendSignature("", h, body, now)).toBe(false);
  });
  it("looks up received headers case-insensitively", () => {
    expect(headerOf({ "In-Reply-To": "<a@x>" }, "in-reply-to")).toBe("<a@x>");
    expect(headerOf(null, "references")).toBeNull();
  });
});

describe("offer content", () => {
  it("turns fired score factors into customer-facing sentences, strongest first", () => {
    const text = issuesText([
      { key: "noHttps", fired: true, weight: 5, points: 5 },
      { key: "notMobileFriendly", fired: true, weight: 15, points: 15 },
      { key: "slow", fired: false, weight: 10, points: 0 },
    ]);
    expect(text.split("\n")).toEqual([
      "- Web se špatně zobrazuje na mobilu, odkud dnes přichází většina návštěvníků.",
      "- Web nemá zabezpečené připojení (HTTPS), takže ho prohlížeče označují jako nezabezpečený.",
    ]);
  });
  it("lists the package templates", () => {
    expect(tierComparisonText([{ name: "Základ", monthlyPriceHalere: 49000, features: ["Hosting"] }])).toBe(
      "Základ – 490 Kč měsíčně\n  • Hosting",
    );
  });
});

describe("contract PDF", () => {
  it("keeps line structure", () => {
    const blocks = parseContract("# Smlouva\n\n**A:** x\n**B:** y\n\n## 1. Předmět\n- bod");
    expect(blocks.map((b) => b.type)).toEqual(["h1", "gap", "p", "p", "gap", "h2", "li"]);
    expect(blocks[2].runs).toEqual([
      { text: "A:", bold: true },
      { text: " x", bold: false },
    ]);
  });
  it("renders a PDF with Czech characters", async () => {
    const pdf = await renderContractPdf(
      "# Smlouva o dílo\n\nPříliš žluťoučký kůň úpěl ďábelské ódy.",
      "Test",
    );
    expect(Buffer.from(pdf.slice(0, 5)).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(2000);
  });
});

describe("reputation wording", () => {
  it("has no nested brackets", () => {
    const t = issuesText([
      {
        key: "strongReputationWeakWeb",
        fired: true,
        weight: 25,
        points: 25,
        detail: "Hodnocení 4,4 (305 recenzí)",
      },
    ]);
    expect(t).toBe("- Máte skvělé hodnocení na Googlu – 4,4 (305 recenzí), ale web to zatím neukazuje.");
  });
});
