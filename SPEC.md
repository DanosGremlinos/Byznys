<context>
I run a one-person business building websites for local Czech businesses (pizzerias, salons, trades) and selling them on a monthly subscription. I need an internal web app (single admin user: me) that covers the whole pipeline: find leads → build a site → send offers → manage subscriptions → chase overdue payments.

Starting state: empty repository.
Target state: a working Next.js app deployed on Vercel, data in Neon Postgres, built in 4 phases. You stop after each phase for my review.

UI language: Czech. Code, comments, DB names: English. Currency: CZK. Dates: Czech format (d. M. yyyy), timezone Europe/Prague.
</context>

<stack>
- Next.js (App Router, TypeScript strict), Tailwind, shadcn/ui
- Neon Postgres + Drizzle ORM with migrations
- Auth: single admin login (Auth.js or Neon Auth), every route protected
- Charts: Recharts
- AI tasks (email drafting, reply classification, lead scoring explanations): Anthropic API via ANTHROPIC_API_KEY
- Lead data: official Google Places API (GOOGLE_PLACES_API_KEY) — NEVER scrape Google Maps HTML. Website checks: fetch the business's own site + PageSpeed Insights API.
- Email and payments: put each behind a provider interface (EmailProvider, PaymentProvider). Propose a provider for each (email must support inbound replies via webhook; payments must support CZK recurring billing and payment links) and wait for my approval before installing.
- All secrets ONLY in env vars, listed in .env.example. Never hardcode or log them.
- Every external service that receives personal data (Anthropic, email provider, payment provider, Neon, Vercel) is a GDPR processor: list it in /docs/legal/processors.md with region and DPA link. Send the AI only the fields a task needs (no full lead records, no payment data).
</stack>

<legal>
Rules that apply to every module. The app must enforce them in code, not only in docs. Background and sources: /docs/legal/PRAVNI-PASTI.md. Legal text the owner must supply lives in /content/legal/*.md as placeholders marked [DOPLNIT].

L1 Unsolicited commercial email (zákon č. 480/2004 Sb., § 7). Czech law requires prior consent for commercial email to ANY address, businesses included; the only exception is an existing customer. So:
- A lead has `contact_basis` (none | consent | existing_customer) and `consent_source`/`consent_at`. The send function hard-blocks offer emails (L1–L3) when `contact_basis = none`, the same way it blocks the blacklist.
- First contact with a cold lead happens outside email (phone, visit, the business's own contact form handled manually). The app supports this with a "Kontaktováno jinak" log and a consent-capture link (`/souhlas/[token]`) that records consent with timestamp, IP and the exact wording shown.
- Every commercial email is labelled as such, shows the sender identity (see L5) and has a working one-click unsubscribe (also `List-Unsubscribe` header).

L2 GDPR for lead data. Sole traders (OSVČ), contact persons, personal emails and phones are personal data.
- Lawful basis for storing leads: legitimate interest, with the assessment text in /content/legal/lia.md.
- Article 14 notice: the first message to a lead (any channel) must point to the privacy notice at `/ochrana-udaju` (public page, the only unauthenticated route besides `/souhlas/*` and `/odhlasit/*`).
- Retention: a lead with no consent and no contract is anonymised automatically 6 months after creation (configurable). Unsubscribed addresses stay only as a SHA-256 hash in the blacklist.
- Data-subject actions on each lead/client: export (JSON) and erase (keeps only the blacklist hash and accounting records required by law).
- Record each lead's `source` (places_api | own_website | manual) per field group.

L3 Google Maps Platform terms. Places content may not be scraped, copied into your own database long-term or reused outside Google's display rules.
- Store `place_id` permanently. Other Places fields (rating, review count, hours, phone, Places photos, reviews) are cached at most 30 days with `fetched_at`, then refreshed or deleted by a cron job.
- Places photos and review texts are never downloaded into Vercel Blob and never passed into the Builder prompt. When shown in the app they carry Google attribution.
- Data scraped from the business's own website is stored separately and is not subject to this rule.

L4 Copyright and the client's materials. Photos, logo, texts and price lists found on a lead's website or Google belong to the business or to third parties (photographers, reviewers).
- Every asset has `rights_status` (unknown | client_provided | client_approved | own | licensed). Only `client_provided`, `client_approved`, `own` or `licensed` assets go into a production Builder prompt; `unknown` assets may only appear in a clearly marked non-public demo ("NÁHLED – NENÍ VEŘEJNÉ").
- Preview links of a demo site built from a lead's materials are unlisted, `noindex`, password- or token-protected and expire after 30 days.
- Testimonials: only reviews the client has confirmed it may use with the reviewer's permission, or reviews the client collected itself. Never Google review texts.

L5 Identification of the business (zákon č. 89/2012 Sb., § 435; zákon č. 455/1991 Sb., § 63). Every outgoing email, contract, invoice and the public pages show: business name, IČO, sídlo, and the trade register entry ("zapsán v živnostenském rejstříku"). Store these once in settings (`/nastaveni/firma`) and render them from there; the send function refuses to send if they are empty.

L6 Contract, subscription and dunning.
- The contract template (/content/legal/smlouva-sablona.md, placeholders) must contain: who owns the website code, content and domain, and what the client gets on cancellation; the right to suspend the site for non-payment and the notice period before it; price incl./excl. DPH; notice period; liability limit; personal-data processing agreement (the provider hosts the client's contact-form data → the provider is the client's processor, GDPR art. 28).
- Dunning: day 7 suspension warning is sent only if the client's signed contract contains the suspension clause (`contract.allows_suspension`). Suspension itself is a manual action after the deadline in the warning, never automatic.
- Late-payment charges follow nařízení vlády č. 351/2013 Sb. (statutory interest; flat 1 200 Kč collection cost per invoice between businesses). Don't invent other fees.
- Invoices carry the data required for a tax document (zákon o DPH § 29 if VAT-registered; otherwise "Nejsem plátce DPH").
- The Builder prompt always includes a "Právní minimum webu" block for the client's site: privacy notice, cookie consent that blocks non-essential cookies/analytics until consent, business identification (L5), and, if the site sells online, terms and consumer withdrawal info. These are the client's obligations, so the prompt inserts placeholders the client fills, never invented legal text.
</legal>

<modules>
1. DASHBOARD
- Stat cards: active websites, active subscriptions, MRR; new leads this week, offers sent, reply rate, conversion rate
- Website tiles: name, domain, client, subscription (tier, price, next billing date), quick actions (open site, send email), unread-mail badge with count (click → that client's inbox thread)
- Filters: tier, name, status
- History: timeline of sales and subscription events; revenue chart with monthly/yearly toggle

2. LEADS (Scraping/Filtering)
- Search form: category + city/area → background job queries Places API, then analyzes each result's website
- Stored per lead: name, address, phone, email, opening hours, services/menu/price list (if found on their site), social links, photos, top reviews (for scoring and display only — not as testimonials, see L3/L4), logo, brand colors, contact person; plus `source` per field group, `contact_basis`, `fetched_at` for Places data (see <legal> L2, L3)
- Opportunity score 0–100, computed by a transparent weighted function (weights in one config file) from: no website, outdated site (old copyright year, old tech), poor design, not mobile-friendly, slow (PageSpeed), no HTTPS, missing basic SEO (title, meta description, h1), high rating + many reviews but weak web presence
- Table sorted by score desc; each row shows which factors fired; action "Postavit web" → Builder with data prefilled
- Also export a reusable agent prompt (stored in /prompts/lead-research.md) for deeper manual research of a single lead

3. BUILDER (generates a prompt, does not build sites itself)
- Entry points: from a lead ("Postavit web"), from a dashboard website ("Otevřít v builderu"), "Nový prázdný projekt"
- Client info form (prefilled, editable)
- Assets panel: photos from the business's own website (select, drag to reorder, mark hero), logo (scraped or upload), client-approved testimonials (checkbox to include), own uploads (photos, PDFs, menus) — store files in Vercel Blob. Each asset shows and edits its `rights_status` (see <legal> L4); Places photos and Google reviews are not offered here.
- Site structure: one-page/multi-page; pages (Home, About, Services, Gallery, Pricing, Contact…); sections (hero, services, gallery, reviews, map, opening hours, contact form, FAQ); extras (reservations, blog, multilingual, e-shop)
- Style: template (Industrial, Economy, Premium, Business, VIP), color palette (auto-extract from logo or manual), fonts, mood (modern, elegant, playful, minimal…), reference URLs
- Custom instructions textarea
- "Vygenerovat prompt" → assembles everything into one structured prompt for Claude Code, shows it, copy-to-clipboard button. Save every generated prompt version to the project.
- Prompt mode: "Demo" (may use `unknown`-rights assets, adds noindex + watermark) or "Produkce" (only cleared assets). The prompt always ends with the "Právní minimum webu" block (see <legal> L6).

4. MESSAGING / OFFERS
- Agent drafts personalized emails in Czech using lead data (business name, concrete issues found on their current site)
- Before L1: the lead needs `contact_basis` ≠ none (consent captured via `/souhlas/[token]` after first contact by phone/in person), see <legal> L1.
- 3 levels: L1 offer email with preview link/screenshot of the prepared design; L2 final design + contract (PDF from an editable template) + proposed subscription budget; L3 subscription offer with tier comparison and payment link
- Every outgoing email goes to an approval queue; I review/edit and click send. NEVER auto-send.
- Inbox: all incoming replies linked to client; agent classifies (interested / not interested / question / change request), I can override
- Editable email templates, send/reply statistics
- Every email has an unsubscribe link; unsubscribed addresses go to a blacklist that the send function checks and hard-blocks
- Every email footer: business identification (L5), link to `/ochrana-udaju`, label "obchodní sdělení" on offers. The send function also blocks when `contact_basis = none` or company settings are empty.

5. SUBSCRIPTIONS & BILLING
- Tiers configurable in DB (name, monthly price, features)
- Upgrade / downgrade / cancel, with event logged to history
- Upcoming renewals list
- Contract record per client: template version, signed date, signed PDF, `allows_suspension` (see <legal> L6)

6. OVERDUE PAYMENTS
- List with filters/sort: amount, days overdue, client
- Dunning sequence of 3 emails: day 0 friendly reminder; day 3 reminder with payment link; day 7 final notice + warning of site suspension (only if the contract allows it; otherwise final notice without the warning). Runs via Vercel Cron; stops immediately when payment arrives. Each step visible and pausable per client.
- Suspension is a manual button available only after the deadline stated in the day 7 email. Late-payment charges only as allowed by NV 351/2013 Sb. (see <legal> L6).
</modules>

<phases>
Phase 0 — Scaffold, auth, full DB schema (all modules), seed script with realistic fake Czech data, app shell with navigation. Deploy to Vercel preview.
Phase 1 — Dashboard, Leads, Builder.
Phase 2 — Messaging/Offers + Inbox.
Phase 3 — Subscriptions, billing, Overdue payments.

At the start of Phase 0, show me a short plan (schema tables + folder structure) and wait for approval before writing code.
At the end of EACH phase: run typecheck, lint, and tests; deploy a preview; then STOP and report: what was built, test results, preview URL, open questions. Do not start the next phase until I say so.
</phases>

<constraints>
- Build only what is listed. No extra features, no multi-tenancy, no public signup, no i18n beyond Czech UI. The <legal> section is part of the scope, not an extra.
- Stop and ask before: adding any dependency not named in <stack>, changing the DB schema after Phase 0 approval, deleting files, running anything against the production DB branch, or connecting real email/payment provider credentials.
- Development uses a Neon dev branch and the seed data. Email and payment providers run in test/sandbox mode; in dev, emails are logged, not delivered.
- Long-running work (lead search, site analysis, dunning) runs as background jobs with status shown in the UI — never blocks a request.
- If a step fails 3 times in a row, stop and report the error instead of retrying.
</constraints>

<done_when>
- Every module item above is reachable in the UI and works on seed data
- Lead score is reproducible and each factor is visible
- Builder produces a complete, copyable prompt from a lead in one click
- No email can be sent without my approval, and blacklisted addresses are always blocked
- Offer emails to leads without consent are blocked; every email carries business identification and the unsubscribe link (tests cover both)
- Places data older than 30 days is refreshed or removed; no Places photo or review reaches Blob or a Builder prompt
- A "Produkce" Builder prompt contains no asset with `rights_status = unknown`
- Lead export and erase work; unconsented leads are anonymised after the retention period
- Typecheck, lint and tests pass; preview deployment loads; all routes require login except `/ochrana-udaju`, `/souhlas/*`, `/odhlasit/*`
</done_when>
