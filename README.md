# Readiness

Certification prep for the Anthropic **Claude Certified Architect — Foundations (CCA-F)** exam:
practice questions, a per-domain breakdown, and an estimated score on the exam's own
1000-point scale.

An independent study tool. Not affiliated with, endorsed by, or produced by Anthropic.

> **Verify the exam facts before going public.** The question count, duration, pass mark, and
> domain weights come from a third-party prep guide, not from published Anthropic material.
> They are stored as data (`prisma/seed/certifications/cca-f.json`), never hardcoded, so a
> correction is a seed edit rather than a code change.

## Getting started

```sh
pnpm install
cp .env.example .env          # then set AUTH_SECRET: pnpm dlx auth secret
pnpm db:up                    # Postgres 16 in Docker
pnpm prisma migrate deploy
pnpm db:seed                  # CCA-F: 4 domains, 18 subtopics, 40 questions
pnpm dev
```

OAuth credentials are optional in development — migrations, the seed, the test suite, and the
public pages all work without them. Sign-in needs a GitHub and/or Google OAuth app; callback
URL `http://localhost:3000/api/auth/callback/<provider>`.

`pnpm db:demo` seeds a demo learner with completed attempts so the dashboard has data to render.

## Deploying

Hosted on [Vercel](https://vercel.com) (native Next.js/Server Actions support) with
[Neon](https://neon.tech) for production Postgres (neither Vercel nor Netlify host a database).
See [DEPLOYMENT.md](DEPLOYMENT.md) for one-time setup, the env var table, and what runs on
every deploy.

## Scripts

| Command                                             | What it does                                                        |
| --------------------------------------------------- | ------------------------------------------------------------------- |
| `pnpm dev` / `pnpm build`                           | Next.js dev server / production build                               |
| `pnpm test`                                         | Vitest unit tests (scoring, grading, selection, streaks, callbacks) |
| `pnpm typecheck` `pnpm lint` `pnpm format`          | TypeScript, ESLint, Prettier                                        |
| `pnpm db:up` / `pnpm db:down`                       | Start / stop Postgres                                               |
| `pnpm db:migrate` / `pnpm db:seed` / `pnpm db:demo` | Migrate, seed content, seed a demo user                             |
| `pnpm db:studio`                                    | Prisma Studio                                                       |

## How the readiness score works

Per domain, accuracy is pulled toward a neutral 0.5 prior using beta-binomial shrinkage
(`k = 8`), so a handful of lucky answers cannot manufacture a passing estimate. Those values are
weighted by each domain's share of the exam and scaled to 1000. Only the most recent response
per question inside a 90-day window counts, so re-answering something you previously missed
actually moves the number.

Coverage (answers per domain, capped at 15) produces a confidence band. **Below MEDIUM
confidence no pass/fail verdict is shown at all** — an estimate built on thin evidence should
not tell someone they would pass.

The algorithm is pure and lives in `src/lib/scoring/readiness.ts`.

## Layout

```
prisma/            schema, migrations, and JSON seed data
src/app/           routes: marketing (/), auth, dashboard, /c/[certSlug]/...
src/components/    shared UI, including the readiness rail used by hero and dashboard
src/lib/           scoring, grading, question selection, auth config, validation
src/server/        server actions and query modules
```

`/dashboard` is certification-agnostic; everything certification-specific lives under
`/c/[certSlug]/`. That is the whole multi-certification accommodation — the platform is
intended to cover more exams than this one.

## Not in this phase

Coding exercises and the sandbox, PDF/URL ingestion into draft questions, the moderation queue,
timed exam mode with a server-authoritative countdown, spaced repetition, and any second
certification. The schema already carries the enum values and nullable columns those need, so
they slot in without a rewrite.
