---
name: deploy-check
description: Check what's done and what's left before deploying this app to Vercel/Neon, or walk through the deployment steps. Use when the user asks "what's left to deploy", "are we ready to deploy", "how do I deploy this", or wants a deployment status check.
---

# Deployment status check

This app deploys to Vercel (app) + Neon (Postgres free tier), documented in full in
`DEPLOYMENT.md` at the repo root. Read that file first — it's the source of truth for *how* to
deploy; this skill is about figuring out *what's already done*.

## What to check, in order

1. **Read `DEPLOYMENT.md`** for the current target steps (Neon project + branch, `AUTH_SECRET`,
   OAuth decision, Vercel env vars, `vercel-build`).
2. **In-repo state** (things you can verify directly):
   - `package.json` has `postinstall: "prisma generate"` and `vercel-build` running
     `prisma migrate deploy && pnpm db:seed && next build`.
   - `src/generated/prisma` is gitignored (`.gitignore`) — confirms `postinstall` is load-bearing.
   - `prisma/seed.ts` is idempotent (upserts on slug) — confirms safe to re-run on every deploy.
   - `.env.example` matches the vars validated in `src/lib/env.ts` — no drift.
   - `git log` / `git status` — is the deployment doc/scripts change actually committed, or
     still sitting uncommitted?
3. **Things that only exist outside the repo** — these can't be checked from the codebase, so
   ask the user directly rather than guessing:
   - Does a Neon project exist yet? Has a Preview branch been created?
   - Has the repo been imported into Vercel? Are env vars set for both Production and Preview?
   - Was the guest-mode-only vs. real-OAuth decision made, and if real OAuth, are the GitHub/
     Google apps registered with the right callback URLs?
   - Has a first deploy actually been triggered, and did it succeed?

## Reporting back

Give a short status list: done / not done / unknown-ask-user, grouped the same way as the
sections above. Don't re-explain the full deployment doc's content — point to `DEPLOYMENT.md`
for the how-to and only surface what's blocking the next step.

If asked to actually perform deployment steps: only the in-repo steps (editing scripts, docs,
env var references) are something you can do directly. Neon project/branch creation and
Vercel project import/env var configuration happen in those services' dashboards — you cannot
do these yourself; walk the user through them per `DEPLOYMENT.md` instead.
