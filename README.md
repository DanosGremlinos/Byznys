# Byznys

Interní aplikace (jeden admin) pro celý obchodní proces: leady → stavba webu → nabídky → předplatné → upomínky.
Specifikace: [SPEC.md](./SPEC.md) · Stav práce: [PROGRESS.md](./PROGRESS.md)

## Stack

Next.js 16 (App Router, TypeScript strict, Cache Components) · Tailwind CSS 4 · shadcn/ui · Neon Postgres +
Drizzle ORM (postgres.js driver) · Auth.js v5 (single admin, JWT) · Vitest

## Local development

```bash
npm install
cp .env.example .env.local      # fill in values (see below)
npm run db:migrate              # apply migrations to DATABASE_URL_UNPOOLED (Neon dev branch)
npm run db:seed                 # wipe + fill with fake Czech data (refuses VERCEL_ENV=production)
npm run dev
```

Admin login: set `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH` (generate with `npm run hash-password -- 'heslo'`)
and `AUTH_SECRET` (`openssl rand -base64 32`).

## Scripts

| Script | What it does |
| --- | --- |
| `npm run typecheck` | Generate Next.js route types and run `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest. DB integration tests run only when `TEST_DATABASE_URL` points to a throwaway database |
| `npm run db:generate` | Generate a SQL migration from schema changes (`drizzle/`) |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Reset and seed the database (dev/preview only) |
| `npm run db:studio` | Drizzle Studio |

## Project layout

```
drizzle/                 SQL migrations (generated)
src/app/(app)/           authenticated app (shell + module pages)
src/app/login/           login page
src/app/api/             route handlers (auth; later cron, webhooks)
src/components/ui/       shadcn/ui components
src/components/layout/   app shell (sidebar, header, page header)
src/db/schema/           Drizzle schema, one file per module
src/db/seed*.ts          seed data and CLI
src/lib/                 formatting (CZK, dates), password hashing, route rules
src/server/              server-only data access and services
src/proxy.ts             route protection (every route requires login)
tests/                   Vitest tests
```

## Deployment (Vercel)

- Production and Preview env vars: everything from `.env.example`. Preview's `DATABASE_URL` must point to the
  Neon **dev** branch.
- Optional: set `PREVIEW_DB_SETUP=1` in the **Preview** environment only, so preview builds run migrations
  and the seed (`scripts/vercel-build.mjs`). Production builds never touch the database.
