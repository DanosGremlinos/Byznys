# Progress

## Phase 0 — Scaffold, auth, schema, seed, app shell ✅ (preview deploy pending, see open questions)

### Finished
- **Scaffold:** Next.js 16.4 (App Router, TS strict, Cache Components), Tailwind 4, shadcn/ui (new-york, neutral),
  ESLint, Vitest. Czech UI (`lang="cs"`, Geist font with `latin-ext` subset).
- **Auth:** Auth.js v5, Credentials provider, a single admin from env (`ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`
  as a scrypt hash), JWT session (7 days). `src/proxy.ts` protects every route: pages redirect to
  `/login?callbackUrl=…`, APIs return 401. Public routes: `/login`, `/api/auth/*`, plus `/api/webhooks/*`,
  `/api/cron/*` and `/unsubscribe/*`, which will verify a signature, secret or token themselves.
  `requireAdmin()` is a second check inside data access. There is no signup.
  Login also works without JS and keeps the email after a wrong password.
- **DB schema (24 tables, all modules)** in `src/db/schema/`, migration `drizzle/0000_init.sql`:
  - Leads: `jobs`, `leads`, `lead_photos`, `lead_reviews`, `lead_site_analyses`
  - Clients: `clients`, `websites`
  - Builder: `builder_projects`, `builder_assets`, `builder_prompt_versions`
  - Messaging: `email_templates`, `email_threads`, `emails`, `email_attachments`, `contract_templates`,
    `contracts`, `email_blacklist`, `webhook_events`
  - Billing: `subscription_tiers`, `subscriptions`, `subscription_events`, `invoices`, `dunning_runs`, `dunning_steps`
- **Seed** (`npm run db:seed`): deterministic, realistic Czech data:
  - 46 leads (10 categories, 7 cities) with photos, reviews and site analyses
  - 12 clients with 13 websites; 3 tiers (Základ 490 Kč, Standard 990 Kč, Premium 1 990 Kč)
  - 12 subscriptions (with upgrades, downgrades and 1 cancellation) and about 110 monthly invoices
  - 5 overdue invoices at different dunning stages (1 run paused, 1 site suspended, 1 run stopped by payment)
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
- **No payments in the app** (owner's decision). There is no PaymentProvider, no payment webhooks and no
  provider IDs. `invoices` only track what is due: variable symbol, due date, and a payment that is
  *recorded manually*. "Overdue" is derived (`status = 'issued' AND due_date < today` in Prague time),
  never stored. Wherever the spec says "payment link" (L3 offer, dunning step 2), the email will contain bank
  details (`BANK_ACCOUNT`) and the variable symbol instead.
- **Dunning emails go through the approval queue** like every other email. Cron only creates the email
  and marks the step `queued_for_approval`. Steps are on day 0, 3 and 7 after the due date.
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

### Environment notes
- This cloud session's network policy blocks `neon.tech`, `vercel.com`, `api.mailgun.net` and `ui.shadcn.com`.
  shadcn components were copied from the official shadcn GitHub repo instead of using the CLI.
  Development and tests ran against a local PostgreSQL 16.

### Open questions
1. **Preview deploy:** not done yet, because this session can't reach Vercel or Neon. Either:
   (a) import the GitHub repo into Vercel and set the env vars (Preview `DATABASE_URL` = Neon dev branch,
   optionally `PREVIEW_DB_SETUP=1`), and every push to this branch gets a preview URL; or
   (b) allow `*.neon.tech` and `vercel.com` / `api.vercel.com` in this environment's network settings and give
   me a `VERCEL_TOKEN`, and I'll deploy and seed myself.
2. **Payment details in emails:** is the bank account number plus variable symbol enough, or do you also want
   a QR payment code (QR Platba) in dunning emails? That needs a QR library, so it's a new dependency.
3. **Invoices:** the format is `YYYY-NNNN`, the VS is `YYYYNNNN` and payment is due in 14 days. Do you issue
   official invoices elsewhere (e.g. Fakturoid)? If so, should the app only *mirror* the number?
4. **Tiers:** the seeded tiers are placeholders (Základ 490 Kč, Standard 990 Kč, Premium 1 990 Kč). What are
   your real tiers and prices? They will be editable in Phase 3 either way.
5. **Mailgun:** which sending domain and sender name? Replies need an inbound route (e.g. `reply.yourdomain.cz`).
6. **Vercel plan** (Hobby = cron at most once a day, Pro = every minute): this affects how the background job
   safety net and dunning cron are scheduled.

## Phase 1 — Dashboard, Leads, Builder ⏳ (not started; waiting for approval)
## Phase 2 — Messaging/Offers + Inbox ⏳
## Phase 3 — Subscriptions, billing, Overdue payments ⏳
