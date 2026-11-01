// Analyses a business's own website: fetch + HTML heuristics + PageSpeed Insights.
// `analyzeHtml` is pure (unit tested); `fetchSite` / `runPagespeed` do the network work.
import type { ServiceItem, SocialLinks, TechSignals } from "@/db/schema/types";

export type HtmlAnalysis = {
  copyrightYear: number | null;
  techSignals: TechSignals;
  hasTitle: boolean;
  hasMetaDescription: boolean;
  hasH1: boolean;
  hasViewportMeta: boolean;
  designIssues: string[];
  emails: string[];
  socialLinks: SocialLinks;
  logoUrl: string | null;
  brandColors: string[];
  services: ServiceItem[];
};

const SOCIAL_HOSTS: [keyof SocialLinks, RegExp][] = [
  ["facebook", /^(?:www\.|m\.)?facebook\.com$/],
  ["instagram", /^(?:www\.)?instagram\.com$/],
  ["tiktok", /^(?:www\.)?tiktok\.com$/],
  ["youtube", /^(?:www\.)?youtube\.com$/],
  ["linkedin", /^(?:[a-z]{2}\.|www\.)?linkedin\.com$/],
  ["x", /^(?:www\.)?(?:twitter|x)\.com$/],
];

const decodeEntities = (s: string) =>
  s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

/** Visible text of the page (scripts, styles and tags removed), one line per block element. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6]|\/td|\/section|\/article)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? decodeEntities(m[2] ?? m[3] ?? m[4] ?? "") : null;
}

function metaContent(html: string, key: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const n = (attr(tag, "name") ?? attr(tag, "property") ?? "").toLowerCase();
    if (n === key) return attr(tag, "content");
  }
  return null;
}

function absolute(url: string, base: string): string | null {
  try {
    return new URL(url, base).toString();
  } catch {
    return null;
  }
}

const PRICE_RE = /(\d{1,3}(?:[ . ]\d{3})*|\d+)(?:,(\d{1,2}|-))?\s*(?:Kč|,-\s*Kč|CZK)/i;

/** Lines that look like "Item ...... 199 Kč" become service/price-list items. */
export function extractServices(text: string, limit = 30): ServiceItem[] {
  const items: ServiceItem[] = [];
  const seen = new Set<string>();
  for (const line of text.split("\n")) {
    if (line.length > 140) continue;
    const m = line.match(PRICE_RE);
    if (!m || m.index === undefined) continue;
    const name = line
      .slice(0, m.index)
      .replace(/[.…\-–—:|]+\s*$/, "")
      .replace(/\b(od|cena|za)\s*$/i, "")
      .trim();
    if (name.length < 3 || name.length > 90 || /^\d/.test(name)) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const whole = Number(m[1].replace(/[ . ]/g, ""));
    const isFrom =
      /\bod\s*$/i.test(line.slice(0, m.index).trim()) || /\bod\b/i.test(line.slice(0, m.index).slice(-4));
    items.push(
      isFrom || !Number.isFinite(whole)
        ? { name, priceText: line.slice(m.index - (isFrom ? 3 : 0)).trim() }
        : { name, priceHalere: whole * 100 },
    );
    if (items.length >= limit) break;
  }
  return items;
}

/** Most frequent hex colours in inline/embedded CSS, plus theme-color; ignores near-white/black/grey. */
function extractColors(html: string): string[] {
  const counts = new Map<string, number>();
  const theme = metaContent(html, "theme-color");
  const bump = (c: string, n = 1) => counts.set(c, (counts.get(c) ?? 0) + n);
  if (theme && /^#[0-9a-f]{3,6}$/i.test(theme)) bump(normalizeHex(theme), 100);
  const css =
    (html.match(/<style[\s\S]*?<\/style>/gi) ?? []).join(" ") +
    (html.match(/style="[^"]*"/gi) ?? []).join(" ");
  for (const m of css.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) bump(normalizeHex(m[0]));
  return [...counts.entries()]
    .filter(([c]) => !isNeutral(c))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([c]) => c);
}

function normalizeHex(c: string): string {
  const h = c.replace("#", "").toLowerCase();
  return (
    "#" +
    (h.length === 3
      ? h
          .split("")
          .map((x) => x + x)
          .join("")
      : h
    ).toUpperCase()
  );
}

function isNeutral(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  return max - min < 24; // greys, white, black
}

function findLogo(html: string, base: string): string | null {
  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    const hint = `${attr(tag, "class") ?? ""} ${attr(tag, "id") ?? ""} ${attr(tag, "alt") ?? ""} ${attr(tag, "src") ?? ""}`;
    if (/logo/i.test(hint)) {
      const src = attr(tag, "src") ?? attr(tag, "data-src");
      if (src && !src.startsWith("data:")) return absolute(src, base);
    }
  }
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    if (/apple-touch-icon/i.test(attr(tag, "rel") ?? "")) {
      const href = attr(tag, "href");
      if (href) return absolute(href, base);
    }
  }
  const og = metaContent(html, "og:image");
  return og ? absolute(og, base) : null;
}

export function analyzeHtml(html: string, pageUrl: string): HtmlAnalysis {
  const lower = html.toLowerCase();
  const text = htmlToText(html);

  // Copyright year: the latest year appearing next to ©/copyright.
  let copyrightYear: number | null = null;
  for (const m of text.matchAll(
    /(?:©|&copy;|\(c\)|copyright)[^\n]{0,40}?((?:19|20)\d{2})(?:\s*[-–]\s*((?:19|20)\d{2}))?/gi,
  )) {
    const year = Number(m[2] ?? m[1]);
    if (!copyrightYear || year > copyrightYear) copyrightYear = year;
  }

  const generator = metaContent(html, "generator") ?? undefined;
  const jq =
    html.match(/jquery[.-]?(\d+\.\d+(?:\.\d+)?)(?:\.min)?\.js/i) ??
    html.match(/jquery\/(\d+\.\d+(?:\.\d+)?)\//i);
  const tableCount = (lower.match(/<table\b/g) ?? []).length;
  const techSignals: TechSignals = {
    ...(generator ? { generator } : {}),
    ...(jq || /jquery/i.test(html) ? { usesJquery: true } : {}),
    ...(jq ? { jqueryVersion: jq[1] } : {}),
    ...(/\.swf\b|application\/x-shockwave-flash/i.test(html) ? { usesFlash: true } : {}),
    ...(tableCount >= 3 && /<table\b[^>]*(width|cellpadding|bgcolor)=/i.test(html)
      ? { tableLayout: true }
      : {}),
    ...(/<frameset\b/i.test(html) ? { framesetOrIframes: true } : {}),
  };
  const cms = generator?.split(/\s/)[0];
  if (cms) techSignals.cms = cms;

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
  const description = metaContent(html, "description")?.trim();
  const hasViewportMeta = metaContent(html, "viewport") !== null;

  const designIssues: string[] = [];
  if (!hasViewportMeta) designIssues.push("Text a rozvržení nejsou přizpůsobené mobilu");
  if (/<font\b/i.test(html) || /<center\b/i.test(html) || /<marquee\b/i.test(html))
    designIssues.push("Zastaralé HTML značky (font/center/marquee)");
  if (techSignals.tableLayout) designIssues.push("Rozvržení pomocí tabulek");
  const imgs = html.match(/<img\b[^>]*>/gi) ?? [];
  if (imgs.length >= 4 && imgs.filter((t) => !attr(t, "alt")).length / imgs.length > 0.7)
    designIssues.push("Obrázky bez popisků (alt)");
  if ((html.match(/\sstyle="/gi) ?? []).length > 80) designIssues.push("Velké množství inline stylů");
  if (!/<link[^>]+rel=["']?(?:shortcut )?icon/i.test(html)) designIssues.push("Chybí ikona webu (favicon)");
  if (!/tel:|mailto:/i.test(html)) designIssues.push("Chybí klikací telefon nebo e-mail");

  const emails = [
    ...new Set(
      [...html.matchAll(/mailto:([^"'?\s>]+)/gi), ...text.matchAll(/\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g)]
        .map((m) => decodeURIComponent(m[1] ?? m[0]).toLowerCase())
        .filter((e) => !/\.(png|jpe?g|gif|webp|svg)$/.test(e) && !e.endsWith("example.com")),
    ),
  ].slice(0, 5);

  const socialLinks: SocialLinks = {};
  for (const m of html.matchAll(/href=["']([^"']+)["']/gi)) {
    const url = absolute(m[1], pageUrl);
    if (!url) continue;
    const host = new URL(url).hostname.toLowerCase();
    for (const [key, re] of SOCIAL_HOSTS) {
      if (re.test(host) && !socialLinks[key] && !/sharer|share\.php|intent\/tweet/i.test(url))
        socialLinks[key] = url;
    }
  }

  return {
    copyrightYear,
    techSignals,
    hasTitle: Boolean(title),
    hasMetaDescription: Boolean(description),
    hasH1: /<h1\b[^>]*>[\s\S]*?\S[\s\S]*?<\/h1>/i.test(html),
    hasViewportMeta,
    designIssues,
    emails,
    socialLinks,
    logoUrl: findLogo(html, pageUrl),
    brandColors: extractColors(html),
    services: extractServices(text),
  };
}

// ---------------------------------------------------------------------------
// Network
// ---------------------------------------------------------------------------

const PRIVATE_HOST =
  /^(localhost|.*\.local|.*\.internal|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1\]?$|\[?f[cd][0-9a-f]{2}:)/i;

/** Only public http(s) URLs may be fetched (basic SSRF guard). */
export function isFetchableUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return (u.protocol === "http:" || u.protocol === "https:") && !PRIVATE_HOST.test(u.hostname);
  } catch {
    return false;
  }
}

export type FetchedSite = { finalUrl: string; httpStatus: number; html: string; isHttps: boolean };

export async function fetchSite(url: string, timeoutMs = 12_000, maxBytes = 1_500_000): Promise<FetchedSite> {
  if (!isFetchableUrl(url)) throw new Error("Neplatná nebo neveřejná adresa webu");
  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; ByznysSiteCheck/1.0)",
      accept: "text/html,application/xhtml+xml",
      "accept-language": "cs,en;q=0.5",
    },
  });
  const finalUrl = res.url || url;
  if (!isFetchableUrl(finalUrl)) throw new Error("Přesměrování na neveřejnou adresu");
  const reader = res.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    while (size < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.byteLength;
    }
    await reader.cancel().catch(() => {});
  }
  const html = new TextDecoder("utf-8").decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
  return { finalUrl, httpStatus: res.status, html, isHttps: finalUrl.startsWith("https://") };
}

/** PageSpeed Insights performance score 0–100 for the given strategy, or null when unavailable. */
export async function runPagespeed(url: string, strategy: "mobile" | "desktop"): Promise<number | null> {
  const key = process.env.PAGESPEED_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
  const params = new URLSearchParams({ url, strategy, category: "performance" });
  if (key) params.set("key", key);
  const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`, {
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    lighthouseResult?: { categories?: { performance?: { score?: number } } };
  };
  const score = json.lighthouseResult?.categories?.performance?.score;
  return typeof score === "number" ? Math.round(score * 100) : null;
}
