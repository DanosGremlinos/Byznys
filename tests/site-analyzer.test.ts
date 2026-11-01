import { describe, expect, it } from "vitest";
import { analyzeHtml, extractServices, isFetchableUrl } from "@/server/leads/site-analyzer";

const OLD_SITE = `<!DOCTYPE html><html><head>
<title>Pizzerie U Kocoura</title>
<meta name="generator" content="Joomla! 1.5 - Open Source Content Management">
<script src="/media/jquery-1.4.2.min.js"></script>
<style>body{background:#ffffff;color:#B91C1C} h2{color:#b91c1c} a{color:#0F766E}</style>
</head><body>
<table width="800" cellpadding="0"><tr><td><img src="/images/logo.png" alt="logo"></td></tr></table>
<table><tr><td><font color="red">Akce!</font></td></tr></table><table><tr><td>x</td></tr></table>
<h2>Jídelní lístek</h2>
<p>Margherita ........ 169 Kč</p>
<p>Quattro formaggi – 219,- Kč</p>
<p>Rozvoz od 49 Kč</p>
<p>Kontakt: info@pizzeriekocour.cz, tel. 603 123 456</p>
<a href="https://www.facebook.com/pizzeriekocour">Facebook</a>
<a href="https://www.facebook.com/sharer/sharer.php?u=x">Sdílet</a>
<p>© 2009 – 2014 Pizzerie U Kocoura</p>
</body></html>`;

const MODERN_SITE = `<!doctype html><html lang="cs"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Salon Elegance</title><meta name="description" content="Kadeřnictví v Brně">
<link rel="icon" href="/favicon.ico"><meta name="theme-color" content="#7c3aed">
</head><body><h1>Salon Elegance</h1><a href="tel:+420777111222">Zavolat</a>
<a href="https://instagram.com/salonelegance">IG</a><footer>Copyright 2025</footer></body></html>`;

describe("analyzeHtml", () => {
  it("detects an outdated site", () => {
    const a = analyzeHtml(OLD_SITE, "http://www.pizzeriekocour.cz/");
    expect(a.copyrightYear).toBe(2014);
    expect(a.techSignals.generator).toMatch(/^Joomla! 1\.5/);
    expect(a.techSignals.jqueryVersion).toBe("1.4.2");
    expect(a.techSignals.tableLayout).toBe(true);
    expect(a.hasViewportMeta).toBe(false);
    expect(a.hasMetaDescription).toBe(false);
    expect(a.hasH1).toBe(false);
    expect(a.hasTitle).toBe(true);
    expect(a.designIssues).toEqual(
      expect.arrayContaining([
        "Rozvržení pomocí tabulek",
        "Zastaralé HTML značky (font/center/marquee)",
        "Chybí ikona webu (favicon)",
      ]),
    );
    expect(a.emails).toEqual(["info@pizzeriekocour.cz"]);
    expect(a.socialLinks).toEqual({ facebook: "https://www.facebook.com/pizzeriekocour" });
    expect(a.logoUrl).toBe("http://www.pizzeriekocour.cz/images/logo.png");
    expect(a.brandColors.slice(0, 2)).toEqual(["#B91C1C", "#0F766E"]);
    expect(a.services).toEqual([
      { name: "Margherita", priceHalere: 16900 },
      { name: "Quattro formaggi", priceHalere: 21900 },
      { name: "Rozvoz", priceText: "od 49 Kč" },
    ]);
  });

  it("finds no problems on a modern page", () => {
    const a = analyzeHtml(MODERN_SITE, "https://salon.cz/");
    expect(a.hasViewportMeta && a.hasTitle && a.hasMetaDescription && a.hasH1).toBe(true);
    expect(a.copyrightYear).toBe(2025);
    expect(a.designIssues).toEqual([]);
    expect(a.socialLinks.instagram).toBe("https://instagram.com/salonelegance");
    expect(a.brandColors[0]).toBe("#7C3AED");
  });
});

describe("extractServices", () => {
  it("ignores lines without a name or a price", () => {
    expect(extractServices("Ceník\n123 Kč\nNovinky")).toEqual([]);
  });
});

describe("isFetchableUrl (SSRF guard)", () => {
  it("allows public http(s) only", () => {
    expect(isFetchableUrl("https://www.pizza.cz")).toBe(true);
    for (const u of [
      "file:///etc/passwd",
      "http://localhost:3000",
      "http://127.0.0.1",
      "http://10.0.0.5",
      "http://192.168.1.1",
      "http://169.254.169.254/latest",
      "ftp://x.cz",
      "nonsense",
    ]) {
      expect(isFetchableUrl(u), u).toBe(false);
    }
  });
});
