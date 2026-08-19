# Tech Stack

Reference map of what runs this app and where it lives. See [`CLAUDE.md`](../CLAUDE.md) for
architectural conventions; this file just answers "what is it built with."

## Frontend

| Layer      | Choice                          | Notes                                                           |
|------------|----------------------------------|------------------------------------------------------------------|
| Framework  | Next.js 16 (App Router)          | Routes under `src/app/`; `src/app/c/[certSlug]/...` is cert-scoped, `src/app/dashboard/` is cert-agnostic |
| UI library | React 19                         | Server Components by default                                    |
| Styling    | Tailwind CSS v4                  | `@tailwindcss/postcss`, `prettier-plugin-tailwindcss` for class sorting |
| Language   | TypeScript 5                     | `pnpm typecheck` = `tsc --noEmit`                                |

## Backend

| Layer          | Choice                        | Notes                                                                 |
|----------------|--------------------------------|------------------------------------------------------------------------|
| Runtime/API    | Next.js Route Handlers + Server Actions | `src/server/actions/` = mutations, `src/server/queries/` = reads |
| Validation     | Zod 4                          | Also enforces required env vars at import time (`src/lib/env.ts`)     |
| Scoring engine | Custom (`src/lib/scoring/readiness.ts`) | Pure functions, no Prisma types — beta-binomial readiness scoring |

## Auth

| Layer     | Choice                    | Notes                                                                         |
|-----------|----------------------------|--------------------------------------------------------------------------------|
| Library   | Auth.js (`next-auth@beta`) | Config split: `src/lib/auth.config.ts` (edge-safe, no Prisma) / `src/lib/auth.ts` (full) |
| Adapter   | `@auth/prisma-adapter`     | Persists sessions/accounts via Prisma                                         |
| Providers | GitHub, Google OAuth       | Optional in dev, required in prod (enforced by `src/lib/env.ts`)              |

## Database

| Layer      | Choice                         | Notes                                                                 |
|------------|---------------------------------|------------------------------------------------------------------------|
| Database   | PostgreSQL 16                  | Local via `docker-compose.yml` (`pnpm db:up` / `db:down`)              |
| ORM        | Prisma 7 (`@prisma/adapter-pg`) | Client generated to `src/generated/prisma`, **not** `node_modules` — run `pnpm prisma generate` after schema pulls |
| Schema     | `prisma/schema.prisma`          | Attempt lifecycle: `QuizAttempt` → `QuizAttemptQuestion` → `QuestionResponse` → `AttemptDomainResult` |
| Seed data  | `prisma/seed/**/*.json`         | Certification/domain/subtopic/question content; `pnpm db:seed`        |
| Migrations | `prisma/migrations/`            | `pnpm db:migrate` (dev, interactive) / `pnpm db:deploy` (CI/prod)      |

## Testing & tooling

| Tool       | Choice           | Notes                                    |
|------------|------------------|-------------------------------------------|
| Test runner| Vitest 4         | `pnpm test` / `pnpm test:watch`           |
| Lint       | ESLint 9         | `eslint --max-warnings=0`                 |
| Format     | Prettier 3       | `pnpm format` / `format:check`            |
| Package mgr| pnpm 11          | `pnpm-workspace.yaml`                     |
| CI         | GitHub Actions (`.github/workflows/ci.yml`) | lint → format:check → prisma validate → generate → typecheck → test → migrate deploy + seed → build |

## Current directory map

```
ccaf/
  docs/                       # product/vision docs, this file
  prisma/
    schema.prisma
    migrations/
    seed/                     # cert/domain/question JSON + seed scripts
  src/
    app/
      (auth)/                 # sign-in routes
      (marketing)/            # landing page
      c/[certSlug]/...        # cert-specific: practice flow, results, domain breakdown
      dashboard/              # cert-agnostic: aggregates across certs
      profile/
      api/
    components/                # shared UI components
    generated/prisma/          # generated Prisma client (checked-in output path)
    lib/
      auth.config.ts / auth.ts
      env.ts                   # zod-enforced env vars
      quiz/                    # selectQuestions, grade
      scoring/                 # readiness.ts (pure scoring logic)
      guest.ts, session.ts
    server/
      actions/                 # mutations
      queries/                 # reads
    types/
    proxy.ts                   # edge middleware (auth.config only, no Prisma)
```
