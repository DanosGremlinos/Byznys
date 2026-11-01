# Progress

## Phase 0 — Scaffold, auth, schema, seed, app shell ✅

**Preview:** https://webbyznys-git-claude-busy-clarke-49tnmm-byznys1.vercel.app (branch alias of the Vercel project
`webbyznys`). Login: `ADMIN_EMAIL` with the generated admin password (given in chat; replace it with your own
hash when convenient).

### Finished
- **Scaffold:** Next.js 16.4 (App Router, TS strict, Cache Components), Tailwind 4, shadcn/ui (new-york, neutral),
  ESLint, Vitest. Czech UI (`lang="cs"`, Geist font with `latin-ext` subset).
- **Auth:** Auth.js v5, Credentials provider, a single admin from env (`ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`
  as a scrypt hash), JWT session (7 days). `src/proxy.ts` protects every route: pages redirect to
  `/login?callbackUrl=…`, APIs return 401. Public routes: `/login`, `/api/auth/*`, plus `/api/webhooks/*`,
  `/api/cron/*` and `/unsubscribe/*`, which will verify a signature, secret or token themselves.
  `requireAdmin()` is a second check inside data access. There is no signup.
  Login also works without JS and keeps the email after a wrong password.
- **DB schema (23 tables, all modules)** in `src/db/schema/`, migrations `drizzle/0000_init.sql` and
  `drizzle/0001_paid_until_no_invoices.sql`:
  - Leads: `jobs`, `leads`, `lead_photos`, `lead_reviews`, `lead_site_analyses`
  - Clients: `clients`, `websites`
  - Builder: `builder_projects`, `builder_assets`, `builder_prompt_versions`
  - Messaging: `email_templates`, `email_threads`, `emails`, `email_attachments`, `contract_templates`,
    `contracts`, `email_blacklist`, `webhook_events`
  - Subscriptions: `subscription_tiers` (templates), `subscriptions`, `subscription_events`, `dunning_runs`, `dunning_steps`
- **Seed** (`npm run db:seed`): deterministic, realistic Czech data:
  - 46 leads (10 categories, 7 cities) with photos, reviews and site analyses
  - 12 clients with 13 websites; 3 package templates (Základ 490 Kč, Standard 990 Kč, Premium 1 990 Kč)
  - 12 subscriptions with per-client prices and features (discounts, extra features), upgrades, downgrades,
    1 cancellation, and the history of recorded monthly payments
  - 5 overdue subscriptions at different dunning stages (1 run paused, 1 site suspended, 1 run stopped by payment)
  - L1/L2/L3 and dunning templates, a contract template, about 66 emails including an approval queue,
    classified replies and unread client messages
  - Blacklist entries plus 1 blocked email, a builder project with assets, and background jobs (including a failed one)
  - The seed refuses to run when `VERCEL_ENV=production`.
- **App shell:** sidebar (desktop) and sheet menu (mobile) linking all modules: Přehled, Leady, Builder,
  Zprávy (Ke schválení, Doručená pošta, Šablony, Statistiky), Fakturace (Předplatné, Neuhrazené platby) and
  Nastavení (Tarify). Each module page is a placeholder listing what comes in which phase. The dashboard shows
  a "Stav databáze" card with row counts to prove the DB connection.
- **Checks:** `npm run typecheck` ✅, `npm run lint` ✅, `npm test` ✅ (19 tests: formatting, password and
  credentials, route protection, navigation, plus a DB integration test that migrates an empty database and
  seeds it, then checks determinism, blacklist and dunning consistency), `next build` ✅.
  The app was checked in a real browser (Playwright): login redirect, wrong password, every route renders,
  logout, and protection after logout.

### Decisions
- **No payments and no invoices in the app** (owner's decision; payments may be revisited after the app is
  finished). There is no PaymentProvider, no payment webhooks, no invoices, no bank details or payment links in
  emails. Wherever the spec says "payment link" (L3 offer, dunning step 2), the email simply asks for payment.
- **"Paid until" model:** each subscription has `paid_until` (the last paid day). When money arrives outside the
  app, it is recorded by clicking "Zaplaceno", which moves `paid_until` forward and logs a `payment_received`
  event with the amount. These events feed the revenue chart. A subscription is **overdue** when
  `paid_until < today` (Prague time). The next payment / renewal date is `paid_until + 1 day`.
- **Dunning** is attached to the subscription and the specific missed `paid_until` (`dunning_runs`). Day 0 is
  the first unpaid day, with steps on day 0, 3 and 7. It stops as soon as a payment moves `paid_until` past the
  missed date. Dunning emails go through the approval queue like every other email: cron only creates the
  email and marks the step `queued_for_approval`.
- **Packages vary per client:** `subscription_tiers` are templates (name, default price, features). Each
  subscription has its own `name`, `price_halere` and `features`, prefilled from a template and freely
  editable. `tier_id` is optional. The L3 email can still compare the templates.
- **Vercel Hobby plan:** cron jobs run at most once a day. The daily cron will create due dunning steps and
  act as a safety net for background jobs. Interactive jobs (lead search, site analysis) run via `after()`
  and process themselves in chunks.
- **Auth.js instead of Neon Auth.** Neon Auth can stay enabled in Neon; its `neon_auth` schema is not used.
- **Email provider: Mailgun (EU region)**, approved. It isn't installed yet (Phase 2); dev uses a log-only provider.
- **DB driver: postgres.js** (`prepare: false`, compatible with Neon's pooled endpoint). One driver for Vercel
  and local Postgres. The `db` handle is lazy, so builds don't need a DB connection.
- **Money** is stored as integer haléře (`*_halere`). Calendar dates (`date`) are used for billing, and
  `timestamptz` for events. Display uses `Intl` with `cs-CZ` and `Europe/Prague`, with no date library.
- **Cache Components stay on** (Next 16 default and the future direction). Pages render their static part
  immediately and stream DB-dependent parts inside `<Suspense>`.
- **Migrations** run manually (`npm run db:migrate`) against the dev branch. Production builds never migrate.
  Preview builds migrate and seed only when `PREVIEW_DB_SETUP=1` is set for the Preview environment.
- The password hash uses `:` as a separator (no `$`), so `.env` variable expansion can't corrupt it.

### Dependencies added (beyond the <stack> list; approved in the plan or required by shadcn/Next)
`zod`, `vitest`, `tsx`, `postgres` (approved driver), `server-only` (Next.js marker package),
shadcn runtime deps `radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`,
`tw-animate-css`. `react-hook-form` was approved but isn't installed yet (forms come in Phase 1).

### Deployment setup (done)
- `vercel.json` pins `framework: nextjs`. The project had been created as "Other", which made the first build fail.
- **Environments:** the Neon Storage connection is connected to **Production only** (main branch, `ep-bitter-haze…`).
  **All preview deployments** (any git branch) use manual Preview variables pointing at the Neon **dev** branch
  (`ep-long-cloud…`): `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `PREVIEW_DB_SETUP=1`, `PREVIEW_DB_EXPECTED_HOST`,
  `AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`. Per-preview Neon branches were rejected because they are
  copied from production (real client data later) and would not be seeded.
- On preview builds, `scripts/vercel-build.mjs` creates the tables, then loads the seed data **only if the
  database is empty**. Both steps are refused unless the DB host equals `PREVIEW_DB_EXPECTED_HOST`, so a preview
  can never touch the production branch. Verified on the dev branch after the first deploy: migration applied,
  seed loaded (46 leads, 12 clients, 66 emails).
- Production env has no `AUTH_SECRET` or admin variables yet, and production builds never touch the database.

### Environment notes
- The cloud session can reach the Neon console/HTTPS API, the Vercel API and `*.vercel.app`, but raw Postgres
  TCP is not possible through its proxy. Migrations and seeding therefore run in the Vercel preview build, and
  local tests use a local PostgreSQL 16. Previews sit behind Vercel Deployment Protection; the owner chose not to
  add an automation bypass, so the owner checks previews in their own browser.
- shadcn components were copied from the official shadcn GitHub repo (`ui.shadcn.com` is blocked).

### Open questions
1. **Mailgun (needed in Phase 2):** a sending domain you own, the sender name, and access to its DNS.

### Answered
- Payments: none in the app (maybe later). Invoices: none. Packages: per client, from templates. Vercel: Hobby.
- Preview databases: all previews share the Neon dev branch; production uses main only.
- Google Places content (reviews, photos): **store it permanently** – owner's decision (needed for building the websites), despite Google's caching terms.

## Phase 1 — Dashboard, Leads, Builder ✅ (waiting for review)

**Preview:** https://webbyznys-git-claude-busy-clarke-49tnmm-byznys1.vercel.app (same login as Phase 0)

### Finished
- **Dashboard** (`/`):
  - Stat cards: active websites, active subscriptions, MRR, new leads (7 days), offers sent (30 days), reply rate
    (offer threads that got a reply) and conversion rate (clients ÷ contacted leads).
  - Website tiles: name, domain, client, package, price, next payment date (marked red when overdue), and an
    unread-mail badge linking to `/messaging/inbox?thread=…`. Quick actions: open site, send e-mail (links to the
    Phase 2 approval queue) and open in Builder. Filters by package, name/domain/client and status.
  - History timeline of sales, package changes, payments and suspensions; revenue bar chart (Recharts) with a
    monthly (12 months) / yearly toggle and a table view.
- **Leads** (`/leads`, `/leads/[id]`):
  - The search form (category + city) starts a background job: Google Places Text Search (New), max 60 results,
    one request per 20 places that includes reviews and photo references. Each lead then gets up to 4 photos, a
    fetch of its own website, PageSpeed (mobile + desktop) and a score.
  - The job panel polls progress; the page refreshes itself when a job finishes.
  - Stored per lead: name, address, phone, e-mail (from the site), opening hours, services/price list (price lines
    on the site), social links, photos, reviews sorted best first, logo, brand colours (CSS/theme-color) and rating.
  - **Opportunity score:** a pure, reproducible function (`src/server/leads/scoring.ts`). The weights and thresholds
    live only in `src/config/scoring.ts`. Every factor is stored with weight, points and a Czech reason, and the
    config hash is stored as `score_version`. Leads without a website score high; an unreachable site counts as no
    website. The copyright rule uses the analysis date, not "today", so re-scoring is reproducible.
    "Přepočítat skóre" re-scores everything from stored data.
  - Table sorted by score (descending), fired factors shown as chips, filters (text, city, category, status,
    minimum score), and a "Postavit web" button on every row.
  - Detail page: all stored data, full factor table, "Vysvětlit skóre (AI)" (Anthropic, `claude-opus-5-5`, low
    effort, server-side refusal fallback), "Znovu analyzovat web", and the research prompt from
    `/prompts/lead-research.md`, filled with the lead's data (copy and download as .md).
- **Builder** (`/builder`, `/builder/[id]`):
  - Entry points: "Postavit web" from a lead creates a prefilled project with photos, logo and reviews **and
    generates prompt v1 in the same click**; running it again opens the same project. Also "Otevřít v builderu"
    on dashboard tiles and "Nový prázdný projekt".
  - Editable client info, including opening hours per day (text input, validated) and the service/price list.
  - Assets panel: select photos, drag to reorder, mark the hero photo; choose the logo (scraped or uploaded);
    tick reviews to use; upload photos/logos/PDFs to Vercel Blob (client upload, up to 25 MB).
  - Structure (one/multi-page, pages, sections, extras), style (5 templates, palette extracted from the logo or
    set manually, fonts, mood, reference URLs) and custom instructions.
  - "Vygenerovat prompt" saves the project and stores a new prompt version. The prompt is shown with a copy button
    and a dropdown of all versions.
- **Background jobs:** `jobs` table with a 290 s lock and about 240 s of work per run; progress is saved after every
  lead. They start via `after()`, the status poll resumes stalled jobs, and a daily Vercel Cron
  (`/api/cron/daily`, needs `CRON_SECRET`) is the safety net. 3 consecutive failures stop the job and show the error.
- **Seed:** leads now carry real scores from the same function, and the seeded Builder project has prompt v1.

### Checks
- `npm run typecheck` ✅, `npm run lint` ✅, `next build` ✅.
- `npm test` ✅: 42 tests in 8 files. They cover scoring (each factor, cap, reproducibility, version), the HTML
  analyzer (old vs modern site, services, colours, socials, logo), the SSRF guard, Places mapping, the prompt
  generator (contents, layout, determinism), opening-hours parsing, palette extraction, month filling, the
  research prompt, and the DB migration + seed integration.
- Browser check (Playwright, local DB):
  - dashboard stats, tiles, filters, chart toggle and timeline;
  - leads sorted by score, filters, and the search error without a key;
  - lead detail and the AI-explain error without a key;
  - a background job running end to end ("Znovu analyzovat web" → "Hotovo");
  - "Postavit web" → Builder with v1 → edit → v2, and the same project reused;
  - Builder from a dashboard tile, and a blank project with invalid-hours validation.

### Decisions
- **No per-place Places Details calls.** Text Search returns everything needed, which is cheaper.
- **Photos:** the stored photo URL is Google's short-lived public `photoUri` (the API key is never stored).
- **Brand colours:** from the site's CSS/theme-color during analysis. In the Builder, "Načíst z loga" extracts
  them from the logo in the browser, via a same-origin image proxy (`/api/image-proxy`, admin-only, public URLs only).
- **Website fetching** is limited to public http(s) addresses (SSRF guard), 12 s and 1.5 MB per page.
- **The prompt for Claude Code is written in Czech** (site content is Czech, and you review it).
- **"Poslat e-mail" on tiles** links to `/messaging/queue?client=…`; composing and approval come in Phase 2.
- **The AI explanation is generated on demand and not stored** (the approved schema has no column for it).
- **No new DB schema changes** in Phase 1. New dependencies: `@vercel/blob` and `@anthropic-ai/sdk` (both named in
  the stack). Additional shadcn components were copied from the official repo.
- Removed `src/server/overview.ts`, the Phase 0 "Stav databáze" placeholder that the real dashboard replaced.

### Open questions / needed from you
1. **Keys (not set yet):**
   - `GOOGLE_PLACES_API_KEY`, `PAGESPEED_API_KEY` (can be the same key) and `ANTHROPIC_API_KEY` in Vercel
     (Preview + Production);
   - a Vercel Blob store connected to the project, which adds `BLOB_READ_WRITE_TOKEN`;
   - `CRON_SECRET` for the daily cron.

   Until then, search, AI explanation and uploads show a clear "missing key" message.
2. ~~Google Places terms~~ → decided: store reviews and photos permanently (owner's decision).
3. **Live Google test:** not run from this session. Once the key is in the session environment (new session), I
   can run one real search to verify the field mapping on real data.

## Phase 2 — Messaging/Offers + Inbox ✅ (waiting for review)

**Preview:** https://webbyznys-git-claude-busy-clarke-49tnmm-byznys1.vercel.app (same login)

### Finished
- **Offers L1 / L2 / L3** (`/messaging/queue/new`, also via "Připravit nabídku" on a lead and "Poslat e-mail" on a
  dashboard tile):
  - The agent fills the level's template with the lead/client data: name, concrete issues from the score factors
    worded for the customer, preview link, package and price. With `ANTHROPIC_API_KEY` set, it also personalises
    the text in Czech (`claude-opus-5-5`, structured output, refusal fallback); without the key the filled template
    is used.
  - L1: preview link + optional screenshot (embedded image).
  - L2: final design + **contract as a PDF** from the editable template + proposed monthly budget. For a lead,
    a client record is created first (agreed).
  - L3: package comparison from the tier templates + the proposed package. There is no payment link (agreed).
- **Approval queue** (`/messaging/queue`):
  - Every outgoing e-mail lands here as `pending_approval`; you can edit the recipient, subject and body, and the
    contract text for L2.
  - It is sent **only** by clicking "Schválit a odeslat". `sendApprovedEmail` is the only send path in the app; it
    is called only from that action and claims the e-mail atomically, so a double click can't send twice.
  - Sending is refused while placeholders are unfilled (`{{…}}`).
  - "Zamítnout" rejects the draft.
- **Blacklist** (`/messaging/blacklist`):
  - The send function checks the recipient at send time and **hard-blocks** it (status `blocked`); the editor also
    warns and disables the button.
  - Entries come from the unsubscribe link, from Mailgun events (permanent bounce, complaint, unsubscribe) and from
    manual adds.
  - Entries can't be removed in the UI, on purpose (unsubscribes must stick).
- **Unsubscribe in every e-mail:**
  - A signed HMAC token (no DB row) is filled into `{{unsubscribeUrl}}`, or appended as a footer when a template
    has none.
  - Every e-mail also carries `List-Unsubscribe` + `List-Unsubscribe-Post` (one-click, RFC 8058).
  - The public page `/unsubscribe/[token]` confirms; `/api/unsubscribe/[token]` writes to the blacklist.
- **Inbox** (`/messaging/inbox`):
  - Conversations with replies, filters (unread, interested, question, change request, not interested) and unread
    counts. Opening a conversation marks it read. The dashboard badge links here.
  - Replies are classified by the agent (interested / not interested / question / change request, with confidence
    and a reason). You can override the classification (stored as "Ručně") or re-run AI.
  - "Připravit odpověď ke schválení" creates a reply draft in the queue, optionally drafted by AI.
  - In dev mode you can simulate an incoming reply.
- **Mailgun:**
  - `MailgunEmailProvider` uses the HTTP API (EU region, `MAILGUN_TEST_MODE=1`). The default `LogEmailProvider`
    logs and never delivers.
  - Inbound replies arrive via a Mailgun Route to `/api/webhooks/mailgun/inbound`; events go to
    `/api/webhooks/mailgun/events`. Both verify the Mailgun HMAC signature with a 15-minute window and are
    idempotent via `webhook_events`.
  - A reply is matched to its thread by In-Reply-To / References, then by the sender's address, else a new thread
    is linked to the client/lead with that e-mail.
- **Templates** (`/messaging/templates`): editable L1–L3 and dunning templates with a variable reference, new and
  deletable custom templates, and an editable contract template (Markdown subset → PDF).
- **Statistics** (`/messaging/stats`): sent / replied / reply rate / interested per level, classification
  breakdown, unread count, outgoing e-mails by status, and the last 6 months.

### Checks
- `npm run typecheck` ✅, `npm run lint` ✅, `next build` ✅.
- `npm test` ✅: 62 tests in 10 files. New ones cover templates and placeholders, unsubscribe tokens (incl. a
  forgery), the footer, HTML escaping, the Mailgun signature (valid, wrong key, tampered, stale), References
  parsing, issue wording, and the contract PDF with Czech characters.
- DB integration tests:
  - a draft never sends by itself; approval sends exactly once with an unsubscribe link and Message-ID;
  - a blacklisted address (any letter case) is blocked and the provider is never called;
  - unfilled placeholders and inbound e-mails are refused;
  - L2 for a lead creates the client, the contract and a valid PDF attachment;
  - inbound matching by In-Reply-To and by address, with duplicates ignored.
- Browser check (Playwright, local DB):
  - lead → offer → queue → edit → send ("✓ Odesláno", logged only);
  - simulated reply → manual classification → reply draft → reject;
  - L2 with an auto-created client, PDF preview, contract edit and send;
  - manual blacklist add → compose warning → send disabled;
  - templates edit, statistics, dashboard badge → inbox.
- curl checks:
  - unsubscribe while logged out (page, form, one-click); a forged token gets 400;
  - signed inbound webhook → linked to the right thread and client; duplicate ignored; bad signature 401;
  - a bounce event puts the address on the blacklist.

### Decisions
- **New dependencies (approved):** `pdf-lib` + `@pdf-lib/fontkit`; the Noto Sans fonts (SIL OFL) are in
  `assets/fonts`. **No Mailgun SDK**: the HTTP API is called with `fetch`.
- **Contract PDFs** are rendered on demand from the stored contract text (`/api/contracts/[id]/pdf`, admin only),
  so they don't need Vercel Blob.
- **Preview/screenshot:** the link is typed in when composing (or taken from the client's website); the screenshot
  is an image URL embedded in the HTML version.
- **Lead status** changes `new` → `contacted` when an offer is sent. Conversion to a client happens at L2 (agreed).
- **Inbox** lists conversations that have at least one reply; other conversations open from the queue via
  "konverzace".
- **No schema changes** in Phase 2.

### Open questions / needed from you
1. **For real e-mail (when you're ready):**
   - a Mailgun account, a sending domain with DNS records, and the env vars `EMAIL_PROVIDER=mailgun`,
     `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_WEBHOOK_SIGNING_KEY`, `EMAIL_FROM`, `UNSUBSCRIBE_SECRET`,
     `APP_URL` (production URL);
   - a Mailgun Route forwarding replies to `https://<app>/api/webhooks/mailgun/inbound`, and event webhooks
     (failed, complained, unsubscribed) to `/api/webhooks/mailgun/events`;
   - your company details for the contract: `PROVIDER_NAME`, `PROVIDER_ICO`, `PROVIDER_ADDRESS`, `PROVIDER_CITY`.
2. **Unsubscribe links on previews** point to the preview URL, which is behind Vercel login. That's fine for
   testing (dev mode doesn't deliver), but real sending must run on production with `APP_URL` set.
3. **AI:** drafting and classification are verified with the key missing (the fallbacks work). A live check with
   `ANTHROPIC_API_KEY` is pending.

## Phase 3 — Subscriptions, packages, Overdue payments ✅ (waiting for review)

**Preview:** https://webbyznys-git-claude-busy-clarke-49tnmm-byznys1.vercel.app (same login)

### Finished
- **Google photos copied to Vercel Blob** (owner's request): when a lead is analysed, each Places photo is
  downloaded and stored in Blob, and the permanent URL is saved. Without `BLOB_READ_WRITE_TOKEN` the temporary
  Google URL is kept.
- **Package templates** (`/settings/tiers`): name, description, default monthly price, features, order and
  active flag. Add and edit them; deactivated ones disappear from offers, existing clients keep their package.
- **Subscriptions** (`/subscriptions`, `/subscriptions/new`, `/subscriptions/[id]`):
  - List with filters (search, status, package) and overdue highlighting.
  - **Upcoming payments in the next 30 days.**
  - **New subscription:** client, existing or new website, template, then the client's own name, price and
    features, start date and "paid until". It logs a sale and marks the lead "Klient".
  - **Zaplaceno:** months (default 1) + amount. Moves "paid until" by whole periods (31. 1. + 1 month → 28. 2.),
    logs the payment (revenue chart) and **immediately stops reminders and withdraws queued ones**.
  - **Change package:** template / name / price / features, logged as an upgrade or downgrade by price with old →
    new values.
  - Pause / resume, cancel (with reason; also cancels reminders), and manual website suspend / reactivate; all
    logged in the history.
- **Overdue payments** (`/overdue`):
  - Every active subscription past its "paid until" date, with amount, days overdue and due date.
  - Filters (search, minimum days) and sorting (days, amount, client).
  - The 3 reminder steps per client with status and a link to the e-mail.
  - Actions: Zaplaceno (1 month), pause/resume reminders, suspend/reactivate website, detail.
- **Reminder engine** (`processDunning`):
  - The daily Vercel Cron `/api/cron/daily` (17 4 * * * UTC ≈ 5–6 am Prague) runs it as a `dunning_run`
    background job; so does the "Zkontrolovat teď" button. The page shows the last check and its result.
  - It starts a sequence on the first unpaid day, then on day 0 / 3 / 7 **puts the reminder into the approval
    queue** (never sends).
  - If several steps are due at once (missed checks), only the latest is queued and the earlier ones are marked
    skipped.
  - Paused sequences create nothing. Runs are closed when paid or when the subscription is no longer active.
  - Sending or rejecting a reminder in the queue updates its step.
  - Website suspension after day 7 stays manual (agreed).

### Checks
- `npm run typecheck` ✅, `npm run lint` ✅, `next build` ✅.
- `npm test` ✅: 72 tests in 12 files. New ones cover date maths (month-end clamping, paid-until periods, days
  overdue) and DB integration:
  - idempotent on the seed;
  - day 0/3/7 drafts in the queue, with nothing sent by the engine;
  - an approved reminder marks its step sent;
  - catch-up queues only the latest step;
  - a paused run creates nothing until it's resumed;
  - a payment stops the run and rejects the queued draft;
  - rejection cancels the step;
  - a downgrade is logged, and the lead is marked converted.
- Browser check (Playwright, local DB):
  - add a package template;
  - subscriptions list, renewals and overdue marks;
  - new subscription with a new website → payment for 2 months → package change → pause/resume → suspend
    website → cancel, with the history matching;
  - overdue list sorted by amount, "Zkontrolovat teď" → job done, pause reminders;
  - "Zaplaceno" removes the row and stops and withdraws that client's reminders;
  - the dashboard reflects the changes.

### Decisions
- "Zaplaceno" defaults to 1 month (editable); suspension is manual; pausing keeps already-queued reminders;
  an unsent day-7 reminder stays in the queue (all agreed).
- Pausing a **subscription** cancels its reminder sequences; cancelling the subscription does too.
- **No schema changes** in Phase 3. The `dunning_run` job type, `paid_until` and the dunning tables come from the
  Phase 0/2 schema.

### Open questions / needed from you
1. **`CRON_SECRET` in Vercel (Production).** Vercel Cron only runs on production deployments. On preview, use
   "Zkontrolovat teď".
2. The **keys** from earlier phases, for live verification: Google Places/PageSpeed, Anthropic, Blob store
   (Builder uploads and permanent photos), and Mailgun for real e-mail.
3. **Production launch:** the production branch has no tables yet, and production env vars (`AUTH_SECRET`, admin
   login, keys) aren't set. When you want to go live, I'll prepare a checklist: migrate production, without the
   seed.
