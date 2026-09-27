# Codebase roadmap — for a Java/Spring developer learning this stack

This is a running, incremental walkthrough of the app, saved so we don't have to re-derive
context each session. Each stop covers real files with real code, explained with Java/Spring
analogies. Work through it top to bottom; append new stops at the bottom as we go.

**Stack, one line:** Next.js 16 (App Router) + React 19 + TypeScript, Prisma 7 + Postgres for
data, Auth.js (NextAuth v5) for auth, Tailwind v4 for styling, no separate REST layer for app
logic (Server Components read the DB directly, Server Actions are the write/RPC path).

## Table of contents

- [x] **Stop 1 — Entry point**: `layout.tsx` + `page.tsx` (root layout, landing page)
- [ ] Stop 2 — Auth: how sign-in works (`src/lib/auth.ts`, `auth.config.ts`, guest sessions)
- [ ] Stop 3 — Dashboard: certification-agnostic aggregation (`src/app/dashboard`)
- [ ] Stop 4 — Starting a quiz attempt (`startAttempt` server action + `selectQuestions.ts`)
- [ ] Stop 5 — Taking the quiz: Client Component + Server Action round trip (`QuestionRunner.tsx`, `submitResponse`)
- [ ] Stop 6 — Finishing an attempt + readiness scoring (`finishAttempt`, `readiness.ts`)
- [ ] Stop 7 — The Prisma schema and DB layer in depth (`schema.prisma`, `db.ts`, migrations)

---

## Stop 1 — Entry point: `layout.tsx` + `page.tsx`

**Files:** `src/app/layout.tsx`, `src/app/page.tsx`

### Why start here

In a Spring app you'd start at `main()` and the `DispatcherServlet` mapping for `/`. In this
Next.js App Router app, there is no `main()` you write yourself — the framework's dev/prod
server owns the process, and *your* first code that runs for any request is:

1. `src/app/layout.tsx` — wraps every single route in the app (the outermost shell)
2. `src/app/page.tsx` — the component that renders specifically for `GET /`

Folder = route is the core App Router rule. `src/app/page.tsx` maps to `/` purely because it's
named `page.tsx` and sits directly in `app/`. There's no routing config file to check — the
filesystem *is* the route table.

### `layout.tsx` — the root layout

```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${sourceSerif.variable} ${jetbrains.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
```

- This is a **Server Component** (no `"use client"` directive at the top of the file).
  It runs once per request, on the server, and never re-runs in the browser.
- `children` is how nesting works: whatever `page.tsx` (or a nested layout) renders gets
  slotted in here. Think of it as a single master template that every view is wrapped in —
  like a Thymeleaf/JSP layout fragment, except it's just a normal React component taking
  `children` as a prop, no special templating syntax.
- The three `next/font/google` calls above it (`Archivo`, `Source_Serif_4`, `JetBrains_Mono`)
  load fonts at **build time** and expose them as CSS custom properties (`--font-archivo`,
  etc.) via the `variable` option. Those variables land on `<html>` so Tailwind's `@theme`
  block (in `globals.css`) can reference them. This is Next.js's built-in font optimization —
  no `<link>` tag to a Google Fonts CDN at runtime, no layout shift while fonts load.
- `export const metadata` is how Next.js generates the `<head>` (`<title>`, `<meta
  description>`) — declarative, not something you build by hand in JSX. Nested routes can
  export their own `metadata` (or a `generateMetadata` function) that overrides/extends this;
  we saw this pattern used for the per-certification pages.

**Java takeaway:** this file is your one shared "master page." There's no controller here,
no request object — just "render this shell around whatever the matched route produces."

### `page.tsx` — the landing page (`/`)

```tsx
export default async function LandingPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const certification = await getCertification(CERT_SLUG);
  if (!certification) { /* ...render an empty state... */ }

  const [questionCount, sample] = await Promise.all([
    getPublishedQuestionCount(certification.id),
    getSampleQuestion(certification.id),
  ]);
  // ...renders the marketing page with real data (question count, sample question, domains)
}
```

Walking through what makes this different from a Java controller method:

1. **`async function` as a component.** Only Server Components can be `async`. React (on the
   server) awaits the function, gets back the resulting JSX tree, and sends HTML/RSC payload
   to the browser. There's no separate "fetch data, then call the view" step you wire up
   yourself — the component *is* both.

2. **`await auth()`** — checks whether there's a signed-in session (Auth.js). If there is,
   `redirect("/dashboard")` is called: a Next.js function that throws a special control-flow
   signal the framework catches to issue an HTTP redirect. (Yes, it works by throwing — that's
   intentional and documented Next.js behavior, not a bug to work around.)

   The comment in the code is worth internalizing:
   > "Done here rather than in the proxy: a JWT decode in the proxy would run on every
   > anonymous hit and defeat caching of this page."

   This is a real architectural decision: they could have done this auth check in
   middleware (Next's version of a servlet filter, which runs before any route), but chose
   to do it inside the page component instead, specifically so anonymous visitors (the
   majority, for a marketing page) get a page that can be cached, rather than paying a JWT
   decode on every single hit.

3. **Data fetching is direct function calls, not HTTP.** `getCertification`,
   `getPublishedQuestionCount`, `getSampleQuestion` are imported from
   `@/server/queries/certifications` — plain async functions that call Prisma directly
   (`db.certification.findFirst(...)` etc. under the hood). No `fetch("/api/...")`, no JSON
   parsing, no client-server boundary at all — this code runs in the same Node process as the
   database client. This is the `src/server/queries/` convention: reads live there, mutations
   live in `src/server/actions/` (covered in Stop 4/5).

4. **`Promise.all([...])`** — two independent queries fetched concurrently rather than
   sequentially. Same idea as parallelizing two independent DB calls with `CompletableFuture`
   in Java, just with native `async`/`await` syntax.

5. **The JSX below is plain conditional rendering** — `{sample ? <SampleQuestion .../> :
   <p>...</p>}`, `{certification.domains.map(domain => (...))}`. No template DSL, it's just
   JavaScript expressions inside `{}`. `.map()` over an array to produce a list of elements is
   the idiomatic React equivalent of a `<c:forEach>`/`th:each` loop.

6. **`SampleQuestion`** (imported from `./(marketing)/_components/SampleQuestion`) is very
   likely a Client Component (interactive — lets an anonymous visitor answer one question
   right there on the landing page). We haven't opened it yet — that's a good candidate for a
   later stop since it's the first interactive widget an anonymous user touches.

### Request flow, summarized

```
GET /
  → RootLayout (server, wraps everything: html/body/fonts/metadata)
      → LandingPage (server, async)
          → auth()                         [checks session — Stop 2]
          → getCertification/...           [reads DB via Prisma — Stop 7]
          → renders JSX, sends HTML to browser
          → <SampleQuestion />             [likely a Client Component — future stop]
```

### Open questions for the next stop

- How does `auth()` actually decide "signed in"? → **Stop 2**
- What does "Continue as guest" (the two links to `/dashboard` with no auth) imply about a
  guest-session mechanism (`src/lib/guest.ts` was flagged earlier)? → **Stop 2**

---

*(Stops 2–7 to be filled in as we continue. Table of contents above tracks progress.)*
