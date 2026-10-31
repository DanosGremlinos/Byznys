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
</stack>

<modules>
1. DASHBOARD
- Stat cards: active websites, active subscriptions, MRR; new leads this week, offers sent, reply rate, conversion rate
- Website tiles: name, domain, client, subscription (tier, price, next billing date), quick actions (open site, send email), unread-mail badge with count (click → that client's inbox thread)
- Filters: tier, name, status
- History: timeline of sales and subscription events; revenue chart with monthly/yearly toggle

2. LEADS (Scraping/Filtering)
- Search form: category + city/area → background job queries Places API, then analyzes each result's website
- Stored per lead: name, address, phone, email, opening hours, services/menu/price list (if found on their site), social links, photos, top reviews (highest rated, usable as testimonials), logo, brand colors, contact person
- Opportunity score 0–100, computed by a transparent weighted function (weights in one config file) from: no website, outdated site (old copyright year, old tech), poor design, not mobile-friendly, slow (PageSpeed), no HTTPS, missing basic SEO (title, meta description, h1), high rating + many reviews but weak web presence
- Table sorted by score desc; each row shows which factors fired; action "Postavit web" → Builder with data prefilled
- Also export a reusable agent prompt (stored in /prompts/lead-research.md) for deeper manual research of a single lead

3. BUILDER (generates a prompt, does not build sites itself)
- Entry points: from a lead ("Postavit web"), from a dashboard website ("Otevřít v builderu"), "Nový prázdný projekt"
- Client info form (prefilled, editable)
- Assets panel: scraped photos (select, drag to reorder, mark hero), logo (scraped or upload), reviews (checkbox to include), own uploads (photos, PDFs, menus) — store files in Vercel Blob
- Site structure: one-page/multi-page; pages (Home, About, Services, Gallery, Pricing, Contact…); sections (hero, services, gallery, reviews, map, opening hours, contact form, FAQ); extras (reservations, blog, multilingual, e-shop)
- Style: template (Industrial, Economy, Premium, Business, VIP), color palette (auto-extract from logo or manual), fonts, mood (modern, elegant, playful, minimal…), reference URLs
- Custom instructions textarea
- "Vygenerovat prompt" → assembles everything into one structured prompt for Claude Code, shows it, copy-to-clipboard button. Save every generated prompt version to the project.

4. MESSAGING / OFFERS
- Agent drafts personalized emails in Czech using lead data (business name, concrete issues found on their current site)
- 3 levels: L1 offer email with preview link/screenshot of the prepared design; L2 final design + contract (PDF from an editable template) + proposed subscription budget; L3 subscription offer with tier comparison and payment link
- Every outgoing email goes to an approval queue; I review/edit and click send. NEVER auto-send.
- Inbox: all incoming replies linked to client; agent classifies (interested / not interested / question / change request), I can override
- Editable email templates, send/reply statistics
- Every email has an unsubscribe link; unsubscribed addresses go to a blacklist that the send function checks and hard-blocks

5. SUBSCRIPTIONS & BILLING
- Tiers configurable in DB (name, monthly price, features)
- Upgrade / downgrade / cancel, with event logged to history
- Upcoming renewals list

6. OVERDUE PAYMENTS
- List with filters/sort: amount, days overdue, client
- Dunning sequence of 3 emails: day 0 friendly reminder; day 3 reminder with payment link; day 7 final notice + warning of site suspension. Runs via Vercel Cron; stops immediately when payment arrives. Each step visible and pausable per client.
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
- Build only what is listed. No extra features, no multi-tenancy, no public signup, no i18n beyond Czech UI.
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
- Typecheck, lint and tests pass; preview deployment loads; all routes require login
</done_when>
