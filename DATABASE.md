# Database Guide (for a Java developer)

This doc explains the database for this project from zero. It assumes you know Java,
Spring/JPA/Hibernate, and nothing about the Node/Prisma world. Every unfamiliar concept gets
a Java-world comparison.

---

## 1. What database are we using, and why

**PostgreSQL 16.** A relational database, same category as the Oracle/Postgres/MySQL you've
used behind a Spring Boot app. Nothing exotic here: tables, foreign keys, transactions, SQL.

Why Postgres specifically:
- It's the default, boring, reliable choice for a relational app with real relationships
  (users → attempts → responses → domains). No NoSQL document-store reasoning was needed here.
- It has first-class support on both the local Docker path and the hosting provider this app
  deploys to (Neon, a "serverless Postgres" host — more in section 4).
- `Decimal` column types are used for scores/weights (`Domain.weight`, `QuizAttempt.rawAccuracy`)
  so percentages sum exactly instead of drifting like a `float`/`double` would. Postgres
  supports `NUMERIC(5,4)` natively, same idea as `java.math.BigDecimal` mapped to
  `NUMERIC` in a JPA entity.

**Java-world equivalent:** this is exactly the Postgres instance you'd point a Spring Boot
app's `application.yml` `spring.datasource.url` at. Same database engine, same SQL underneath.

---

## 2. How it's installed (local dev)

It runs in **Docker**, defined in `docker-compose.yml` at the repo root:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: ccaf-postgres
    environment:
      POSTGRES_USER: ccaf
      POSTGRES_PASSWORD: ccaf
      POSTGRES_DB: ccaf
    ports:
      - "5432:5432"
    volumes:
      - ccaf-pgdata:/var/lib/postgresql/data
```

**Java-world equivalent:** this is your `docker run postgres` or `docker-compose.yml` you'd
use for a local Spring Boot dev database — identical pattern, nothing app-specific about it.
The `volumes` line just means data survives a container restart (it's written to a Docker
volume on disk, not wiped every time you stop the container).

### Commands you'll actually run

| Command | What it does | Java-world equivalent |
|---|---|---|
| `pnpm db:up` | `docker compose up -d` — starts Postgres in the background | starting your local Postgres/Docker container before running a Spring Boot app |
| `pnpm db:down` | stops the container | `docker compose down` |
| `pnpm db:migrate` | applies pending schema migrations, interactively, for local dev | like running Flyway/Liquibase migrations, or Hibernate `ddl-auto=update` but explicit and versioned |
| `pnpm db:deploy` | applies migrations non-interactively (used in CI/prod) | Flyway's `migrate` goal in a CI pipeline |
| `pnpm db:seed` | loads certification/question data from JSON into the DB | a `data.sql` / `DataLoader` / `CommandLineRunner` that seeds reference data on startup |
| `pnpm db:reset` | drops everything and rebuilds from migrations + seed | `DROP SCHEMA public CASCADE` + re-run all migrations, for a clean slate |
| `pnpm db:studio` | opens a browser GUI to browse/edit rows | pgAdmin, DBeaver, or IntelliJ's built-in database tool, but zero-config |

Typical first-time setup, in order:
```sh
pnpm db:up        # start Postgres in Docker
pnpm db:migrate    # create all the tables
pnpm db:seed       # load the certification + question data
pnpm dev           # start the Next.js app
```

---

## 3. How the app connects to the DB — the Java-developer version

This is the part that looks different from Spring, so slow down here.

### 3a. The connection string

Everything starts from one environment variable, `DATABASE_URL`, in a `.env` file
(not committed to git — see `.env.example` for the template):

```
DATABASE_URL="postgresql://ccaf:ccaf@localhost:5432/ccaf?schema=public"
```

**Java-world equivalent:** this is one string doing the job of
`spring.datasource.url` + `spring.datasource.username` + `spring.datasource.password`
combined. Same information (host, port, db name, user, password), just packed into a URL
instead of split across three properties.

### 3b. The ORM: Prisma ≈ your JPA/Hibernate

This app uses **Prisma** as its ORM. Think of Prisma as *"Hibernate, but the entity
definitions are hand-written in one schema file instead of annotated Java classes, and the
repository methods are generated instead of extending `JpaRepository`."*

The schema file is `prisma/schema.prisma`. This is the equivalent of all your `@Entity`
classes combined into one file. A snippet:

```prisma
model User {
  id    String   @id @default(cuid())
  email String?  @unique
  role  UserRole @default(LEARNER)

  attempts  QuizAttempt[]
}
```

Compare to the Java you'd write:
```java
@Entity
public class User {
    @Id
    private String id; // generated, like a UUID

    @Column(unique = true)
    private String email;

    @Enumerated(EnumType.STRING)
    private UserRole role = UserRole.LEARNER;

    @OneToMany(mappedBy = "user")
    private List<QuizAttempt> attempts;
}
```

Same concept, different syntax. `@id @default(cuid())` is like `@Id @GeneratedValue` with a
string ID strategy instead of a sequence.

**From this one file, Prisma generates a fully-typed client** — this is the step that
replaces both your `@Entity` classes AND your `JpaRepository` interfaces at once. Run
`pnpm prisma generate` (or it runs automatically via `postinstall`) and it writes generated
TypeScript code into `src/generated/prisma/`. You never hand-write that generated folder,
same as you never hand-write Hibernate's bytecode-enhanced proxies.

### 3c. Where the actual "give me a connection" code lives

`src/lib/db.ts` is the single place a `PrismaClient` (think: `EntityManager` /
`DataSource` combined) gets constructed:

```ts
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

function createClient() {
  const connectionString = process.env["DATABASE_URL"];
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export const db = globalForPrisma.prisma ?? createClient();
```

Breaking down the unfamiliar pieces for a Java dev:

- **`PrismaPg` adapter** — Prisma 7 requires you to explicitly plug in a "driver adapter"
  that knows how to talk to Postgres over the `pg` driver. This is the equivalent of
  configuring a `HikariDataSource` with a specific JDBC driver class — Prisma just makes
  that step explicit and pluggable instead of it being implicit like Spring Boot's
  auto-configured `DataSource`.
- **`globalForPrisma` caching trick** — Node.js dev servers hot-reload your code on every
  file save. Without this, every hot-reload would create a *brand new connection pool*,
  and you'd exhaust Postgres's max-connections limit within a few minutes of editing code.
  This caches one `PrismaClient` (and its internal connection pool, like a `HikariCP` pool)
  on the global object so it survives reloads. **This has no Spring Boot equivalent** —
  Spring Boot's `ApplicationContext` isn't torn down and rebuilt on every code change the
  way Node's module system is, so this problem doesn't exist there. It only exists because
  of how Next.js dev mode works.
- **Connection pooling** — happens automatically inside the adapter, same idea as HikariCP
  managing a pool of JDBC connections under your `DataSource` bean. You don't manage
  individual connections by hand in either world.

### 3d. Where queries actually get called

Two folders, split by responsibility (this mirrors a `@Service` layer split into
command/query, if you've done CQRS-flavored Spring apps):

- `src/server/actions/` — **mutations** (starting an attempt, submitting an answer,
  finishing an attempt). Equivalent of `@Transactional` service methods that call
  `repository.save(...)`.
- `src/server/queries/` — **reads** (dashboard aggregates, results pages). Equivalent of
  `@Transactional(readOnly = true)` methods calling `repository.findBy...(...)`.

A query looks like this (compare to a Spring Data JPA custom query):

```ts
const attempts = await db.quizAttempt.findMany({
  where: { userId, certificationId },
  orderBy: { completedAt: "desc" },
});
```

```java
List<QuizAttempt> attempts = quizAttemptRepository
    .findByUserIdAndCertificationIdOrderByCompletedAtDesc(userId, certificationId);
```

Prisma's `db.quizAttempt.findMany({...})` is generated from the `model QuizAttempt` block in
the schema, the same way Spring Data derives `findByUserIdAnd...` from your repository
interface method name — just with a fluent object argument instead of a method-name DSL.

### 3e. Migrations: Prisma Migrate ≈ Flyway/Liquibase

There is no `ddl-auto=update` here — schema changes are explicit, versioned SQL files under
`prisma/migrations/`, generated by running `prisma migrate dev` (`pnpm db:migrate`) after you
edit `schema.prisma`. Each migration is a timestamped folder with a `migration.sql` file
inside, applied in order and tracked in a `_prisma_migrations` table in the database itself.

**Java-world equivalent:** this is precisely Flyway's `V1__init.sql`, `V2__add_column.sql`
pattern, or Liquibase changesets, tracked in `flyway_schema_history`. Same philosophy:
schema changes are code, reviewed in PRs, applied in a fixed order, never edited after the
fact.

---

## 4. How it connects when hosted (production)

Locally you're pointed at `localhost:5432` inside Docker. In production, `DATABASE_URL` is
set to a **hosted Postgres instance** instead — the app code doesn't change at all, only the
environment variable does, exactly like changing `application-prod.yml`'s datasource URL
instead of `application-dev.yml`.

The deploy script (`package.json`, `vercel-build`) is:
```
prisma migrate deploy && pnpm db:seed && next build
```
This runs on every deploy: apply any new migrations against the real production database,
re-run the (idempotent) seed, then build. This is your CI/CD pipeline's Flyway-migrate-then-
deploy step, just triggered by the hosting platform instead of a separate Jenkins/GitHub
Actions stage.

One thing worth double-checking, not yet confirmed against the actual hosting dashboard:
serverless hosts like Neon usually want a **pooled** connection string (their PgBouncer
endpoint) rather than the direct one, because each serverless function invocation can be a
fresh process that would otherwise open its own connection and exhaust Postgres's connection
limit under load. Worth verifying which endpoint `DATABASE_URL` points to in the hosting
platform's environment variables before relying on this in front of real traffic.

---

## 5. Schema overview

Three groups of tables, all in `prisma/schema.prisma`:

**Auth** (managed by Auth.js's Prisma adapter — you didn't design these, a library did):
`User`, `Account`, `Session`, `VerificationToken`.

**Content** (the certification/question bank, loaded from JSON — see below):
- `Certification` — one row per exam (e.g. CCA-F), holds exam facts (question count,
  duration, pass score) as data, not hardcoded constants.
- `Domain` — belongs to a `Certification`, has a `weight` (Decimal, so weights sum exactly).
- `Subtopic` — belongs to a `Domain`.
- `Question` — belongs to a `Certification` and a `Domain`, has a `status` (DRAFT →
  IN_REVIEW → PUBLISHED → ARCHIVED/REJECTED) and a `type` (multiple choice, multiple
  select, coding exercise).
- `QuestionOption` — the answer choices. **Correctness lives here** (`isCorrect` on the
  option row), not as an enum on `Question` — that's the design that lets multi-select
  questions work without a schema change.
- `QuestionSubtopic` — a join table (many-to-many), same as a `@ManyToMany` join table
  you'd map in JPA.

**Attempts** (a user taking a quiz):
- `QuizAttempt` — one quiz-taking session. Snapshots `correctCount`/`scaledScore`/`passed`
  once, when finished, so history pages are a cheap read instead of recomputing every time.
- `QuizAttemptQuestion` — the ordered, frozen list of questions for that attempt (frozen so
  editing a question mid-attempt can't break an in-progress quiz).
- `QuestionResponse` — one row per answered question. Denormalizes `userId` and `domainId`
  onto itself (duplicates data that's technically derivable via a join) purely so the
  readiness-score query can avoid joining through `Question` every time. This is a
  deliberate denormalization trade-off, the same kind of call you'd make adding a
  redundant column to speed up a hot JPA query.
- `AttemptDomainResult` — per-domain tally (answered/correct count) for one attempt.

**Everything cascades from `Certification` down** — deleting a certification deletes its
domains, questions, options, etc. (`onDelete: Cascade` everywhere), same as `CascadeType.ALL`
on a parent `@OneToMany` in JPA.

---

## 6. Connecting manually

Assuming local Docker Postgres is running (`pnpm db:up`):

**Option A — psql inside the container (no local install needed):**
```sh
docker exec -it ccaf-postgres psql -U ccaf -d ccaf
```

**Option B — psql from your host machine, if you have the client installed:**
```sh
psql "postgresql://ccaf:ccaf@localhost:5432/ccaf?schema=public"
```

**Option C — Prisma Studio (browser GUI, reads `DATABASE_URL` automatically):**
```sh
pnpm db:studio
```
Closest thing to IntelliJ's database tool window, zero setup.

**Option D — any SQL GUI client** (DBeaver, TablePlus, Postico) — point it at the same
connection string as `.env`.

Once connected, useful things to try:
```sql
\dt                              -- list tables (like listing entities)
SELECT * FROM "Certification";
SELECT * FROM "Question" LIMIT 5;
```

A caution: editing rows by hand via psql/Studio bypasses the seed script's checksum/upsert
logic and Zod validation. For question content specifically, prefer editing the seed JSON
and re-running `pnpm db:seed` rather than hand-editing rows, so the database and source
control don't drift apart.

For connecting to the **hosted/production** database, the same `psql "<DATABASE_URL>"`
pattern applies, with the production connection string pulled from the hosting provider's
dashboard rather than `.env`. Treat that as a shared, live database — confirm you actually
mean to before running anything against it.

---

## 7. Where content data comes from, and how to add more

Reference data (certifications, domains, questions) is **not** entered through the app UI —
it's authored as JSON and loaded by a seed script, similar to a Spring Boot
`CommandLineRunner` reading a `data.sql`/`data.json` on startup.

- `prisma/seed/certifications/cca-f.json` — the exam definition: pass score, duration,
  domain/subtopic tree with weights.
- `prisma/seed/questions/cca-f.json` — the question bank itself (185 questions today), each
  question referencing a `domainSlug`/`subtopicSlugs` that must already exist in the
  certification JSON.

`prisma/seed.ts` validates both files with Zod (think: Bean Validation / `@Valid` on a DTO)
before writing anything, then **upserts** by natural key (`slug` for domains/subtopics,
`externalId` for questions) — safe to run repeatedly, same as an idempotent Liquibase
changeset with `onFail: MARK_RAN`.

**To add a question:** append an object to the `questions` array in
`prisma/seed/questions/cca-f.json` with a unique `externalId`, a `domainSlug`/
`subtopicSlugs` that already exist, and an `options` array with exactly one `isCorrect: true`
(or several, for a `MULTIPLE_SELECT` question). Then run:
```sh
pnpm db:seed
```
If you typo a domain/subtopic slug, the script throws a clear error before writing anything,
rather than silently inserting bad data.

**To add a whole new domain:** edit `cca-f.json` (the certification file) first, reseed, then
reference the new domain's slug from question entries.

**To add a second certification entirely:** you'd add new JSON files plus a small code
change in `seed.ts`'s `main()` (it currently loads `cca-f.json` by name) — not just a data
change.

---

## Quick reference card

| I want to... | Command / file |
|---|---|
| Start the local database | `pnpm db:up` |
| See the "entity" definitions | `prisma/schema.prisma` |
| Change the schema | edit `schema.prisma`, then `pnpm db:migrate` |
| Add reference data (questions, domains) | edit JSON under `prisma/seed/`, then `pnpm db:seed` |
| Browse data in a GUI | `pnpm db:studio` |
| Connect with a SQL prompt | `docker exec -it ccaf-postgres psql -U ccaf -d ccaf` |
| See where the connection is built | `src/lib/db.ts` |
| See where queries/mutations live | `src/server/queries/`, `src/server/actions/` |
| Reset everything to a clean slate | `pnpm db:reset` |
