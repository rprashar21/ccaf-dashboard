# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

A certification-prep quiz app (currently seeded with one exam: Anthropic's CCA-F). Next.js
16 (App Router) + Prisma 7 + Postgres, with a beta-binomial readiness score instead of a raw
percentage. See `README.md` for the product framing and `docs/vision.md` for where this is
headed (ingestion pipeline, coding exercises, a separate Python agent service — none of that
exists yet, but the schema already has the nullable columns/enum values for it).

## Commands

```sh
pnpm dev                      # Next.js dev server
pnpm build                    # production build
pnpm lint                     # eslint --max-warnings=0
pnpm format / format:check    # prettier
pnpm typecheck                # tsc --noEmit
pnpm test                     # vitest run (all tests)
pnpm test:watch               # vitest watch mode
pnpm vitest run src/lib/quiz/grade.test.ts   # single test file
pnpm db:up / db:down          # Postgres 16 via docker-compose
pnpm db:migrate               # prisma migrate dev (local, interactive)
pnpm db:deploy                # prisma migrate deploy (CI / prod)
pnpm db:seed                  # seed cert/domain/subtopic/question content from JSON
pnpm db:demo                  # seed a demo learner with completed attempts
pnpm db:reset                 # prisma migrate reset --force
pnpm db:studio                # Prisma Studio
```

CI (`.github/workflows/ci.yml`) runs, in order: lint, format:check, `prisma validate`,
`prisma generate`, typecheck, test, `migrate deploy` + `db:seed` against a fresh Postgres, then
build. OAuth env vars are placeholders in CI — the app must work without real OAuth
credentials outside of actually signing in (enforced by `src/lib/env.ts`).

Prisma client is generated to `src/generated/prisma` (not the default `node_modules`
location) — run `pnpm prisma generate` after pulling schema changes.

## Architecture

**Everything is scoped to a `Certification`.** No exam fact (question count, duration, pass
mark, domain weights) is hardcoded — they're columns on `Certification`/`Domain`, seeded from
`prisma/seed/certifications/*.json`, because they came from a third-party source and will need
correcting. Correctness of quiz options also lives in data (`QuestionOption.isCorrect`), not in
an enum on `Question`, which is what lets `MULTIPLE_SELECT` work without a schema change.

**Route split**: `/dashboard` is certification-agnostic (aggregates across certs). Everything
certification-specific lives under `src/app/c/[certSlug]/...` (domain breakdown, practice
flow, results). Keep that boundary — don't leak `certSlug`-specific logic into
`/dashboard`, and don't hardcode a certification slug anywhere outside seed data/tests.

**Attempt lifecycle** (`prisma/schema.prisma` models `QuizAttempt` → `QuizAttemptQuestion` →
`QuestionResponse` → `AttemptDomainResult`):
1. Starting an attempt snapshots an ordered slate of questions into
   `QuizAttemptQuestion` (`src/lib/quiz/selectQuestions.ts`) so the runner is resumable and
   immune to a question being archived mid-run.
2. Each answer is graded (`src/lib/quiz/grade.ts`) and written as a `QuestionResponse`, which
   denormalizes `userId`/`domainId` so downstream readiness queries never join through
   `Question`.
3. Finishing an attempt writes `correctCount`/`rawAccuracy`/`scaledScore`/`passed` once, so
   history and results pages are a single cheap read instead of recomputing.

**Readiness scoring** (`src/lib/scoring/readiness.ts`, pure — no Prisma types, no DB access):
per-domain accuracy is pulled toward a neutral 0.5 prior via beta-binomial shrinkage before
being weighted by domain share and scaled to the exam's point scale. Coverage (capped at 15
answers/domain) drives a confidence band, and **no pass/fail verdict is returned below MEDIUM
confidence** — preserve that behavior in any change here. Callers aggregate `QuestionResponse`
rows into `DomainTally` and pass exam facts in; keep new scoring logic in this pure-function
style and add corresponding tests (`readiness.test.ts`) rather than asserting behavior only
through integration.

**Server actions vs. queries**: `src/server/actions/` are mutations (starting/answering/
finishing attempts); `src/server/queries/` are reads for dashboard/certification pages. Follow
this split for new server-side logic rather than mixing reads and writes in one module.

**Auth**: Auth.js (`next-auth@beta`) with the Prisma adapter, configured in
`src/lib/auth.config.ts` / `src/lib/auth.ts`. GitHub/Google OAuth credentials are required in
production but optional in development (`src/lib/env.ts` enforces this at import time via
zod) — don't add code paths that assume OAuth env vars are always present.

## Notes

- `next.config.ts`, `prisma.config.ts`, and the `pnpm-workspace.yaml` are minimal; check them
  before assuming a convention that doesn't apply here.
- The `.idea` directory and `dev.log` are local/IDE artifacts, not project config.
