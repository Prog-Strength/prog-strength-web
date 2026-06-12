# AGENTS.md

Working guidance for AI agents (and a fast orientation for humans) contributing to
`prog-strength-web`. The [README](README.md) covers setup, environment variables, and project
background; [CONTRIBUTING.md](CONTRIBUTING.md) covers the contribution process in detail. This file
covers what you need to know to make a correct, mergeable change.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## What this app is

Prog Strength is a fitness tracker that helps lifters answer "am I actually getting stronger?"
through logged workouts, bodyweight history, nutrition tracking, and an AI chat agent that reads
from the same data. This repo is the **browser client only**. It owns no data and holds no secrets:

- The Go API ([`prog-strength-api`](https://github.com/Prog-Strength/prog-strength-api)) is the
  system of record. Every read and write goes through it.
- The agent service ([`prog-strength-agent`](https://github.com/Prog-Strength/prog-strength-agent))
  streams the `/chat` page's conversation over SSE.
- Changes spanning more than one repo start as a SOW in
  [`prog-strength-docs`](https://github.com/Prog-Strength/prog-strength-docs); changes scoped to
  this repo are normal PRs against `main`.

## Architecture

Next.js 16 App Router, React 19, TypeScript, Tailwind v4. No CSS-in-JS, no UI kit — components are
hand-rolled. Everything renders client-side against the Go API; there are no server actions, API
routes, or server-side data fetching in this repo.

```
app/
  login/, auth/, beta-locked/   Unauthenticated: Google OAuth entry, callback, allowlist gate.
  (app)/                        Route group for the authenticated shell (shared sidebar layout).
    activities/ bodyweight/ calendar/ chat/ exercises/ nutrition/
    personal-records/ progress/ running/ settings/ workouts/
    <route>/_components/        Page-private components co-locate with their route.
  providers.tsx                 Client providers (TanStack Query, profile/usage contexts).
components/                     Cross-page components, grouped by domain subfolder where it helps.
lib/
  api.ts                        Typed wrappers over the Go API — one function per endpoint.
  agent.ts, stream.ts           SSE client for the agent's /chat stream.
  auth.ts                       JWT storage (localStorage) + sign-out.
  config.ts                     NEXT_PUBLIC_* env reads with local-dev defaults.
  *-context.tsx                 React contexts (profile, usage, distance unit).
```

Data-flow rules that keep the app coherent:

- **All API calls go through `lib/api.ts`.** Need a new endpoint? Add the typed wrapper there
  first, then call it from the page. Never ad-hoc `fetch` in a component.
- **Auth is a JWT in `localStorage`** (`lib/auth.ts`), attached as `Authorization: Bearer …` by the
  `lib/api.ts` wrappers. There is no SSR auth — a 401 means clear the token and redirect to
  `/login` (existing pages show the pattern).
- **Most pages are `fetch` + `useState`.** TanStack Query is used only where a real cache pays for
  itself. Match the pattern of the page you're touching rather than introducing a new one.
- **Runtime config is `NEXT_PUBLIC_*` only**, read through `lib/config.ts`. Never read
  `process.env` elsewhere, and never add a server-side secret — this bundle is fully public.

## Conventions

- **Components**: page-private components live in the route's `_components/` folder; anything used
  by two or more pages lives under `components/`. Promote on second use, not preemptively.
- **Styling**: Tailwind utility classes with CSS variables for theme colors
  (`var(--border)`, `var(--muted)`, `var(--danger)`, …). Match the look of neighboring surfaces
  before inventing new spacing or color.
- **Tests**: Vitest + Testing Library, co-located as `*.test.ts(x)` next to the code under test.
  Components and hooks render via jsdom; `lib/` modules get plain unit tests. New behavior with any
  logic in it should arrive with a test.
- **Charts** are recharts; shared formatting helpers live in `lib/format.ts` and
  `lib/chart-format.ts`.
- **Domain gotcha — dumbbell weight is per dumbbell**, not the combined pair. A set logged with
  "50s" has `weight = 50`. Anything rendering or aggregating set weight must respect this.

## Working in this repo

```bash
npm ci                # install (Node 20+; CI runs 20)
npm run dev           # dev server at :3000 (pages 401/empty without the Go API at :8080)
npm run test          # vitest, single run
npm run typecheck     # tsc --noEmit
npm run lint          # eslint
npm run build         # production build — what CI gates merges on
```

Before claiming a change is done, run `npm run typecheck && npm run lint && npm run test` at
minimum; run `npm run build` if you touched anything structural (routes, layouts, imports, config).
CI runs all four plus a Prettier check, and a merge is blocked until they pass.

Frontend-only work (styling, component logic with mocked data) runs fine without the backends.
Anything touching real data flows needs `prog-strength-api` running locally — see its README.

Known lint posture: React 19's new `react-hooks` rules (`purity`, `set-state-in-effect`,
`immutability`) are **warnings, not errors** (see `eslint.config.mjs`) because the codebase
predates them. Don't introduce new warnings, but don't mass-fix old ones in an unrelated PR either.

## Commits and PRs

- **Conventional Commits are enforced.** A Husky `commit-msg` hook runs commitlint
  (`@commitlint/config-conventional`); CI re-checks every PR commit _and the PR title_. PRs are
  squash-merged, so the PR title becomes the commit subject on `main` — that title is what a future
  semantic-release will read to compute versions. Format: `type(scope): subject`, e.g.
  `feat(nutrition): add quick-add modal` or `fix(chat): reconnect SSE after token refresh`.
- The Husky `pre-commit` hook runs lint-staged (ESLint + Prettier on staged files) and a full
  typecheck. **Never commit with `--no-verify`** — if the hook fails, fix the cause.
- Keep PRs scoped to one concern. Don't fold drive-by refactors into a feature change.
- See [CONTRIBUTING.md](CONTRIBUTING.md) for branch naming, the full check matrix, and PR
  expectations.
