# prog-strength-web

Web client for [Prog Strength](https://progstrength.fitness) — a side-project fitness tracker that
helps lifters answer "am I actually getting stronger?" through logged workouts, bodyweight history,
nutrition tracking, and an AI chat agent that reads from the same data.

This repo is the browser-facing app. It does not own any data; the Go API in
[`prog-strength-api`][api] is the system of record, and the FastAPI service in
[`prog-strength-agent`][agent] hosts the streaming chat that this app's `/chat` page talks to.

## Stack

- **Next.js 16** (App Router, Turbopack, React 19)
- **TypeScript** + **Tailwind v4** (`@tailwindcss/postcss`)
- **recharts** for the workout / bodyweight / nutrition charts
- **TanStack Query** for the few places we need a real cache; most pages just `fetch` + `useState`
- **ESLint 9** + **Prettier 3** + **Husky** + **lint-staged** for the pre-commit gate

No CSS-in-JS, no UI kit. Components are hand-rolled and live alongside the routes they serve.

## Sibling repos

| Repo                             | Role                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| [`prog-strength-api`][api]       | Go HTTP API. Single SQLite DB. System of record for workouts, bodyweight, nutrition. |
| [`prog-strength-mcp`][mcp]       | MCP server that wraps the API. The boundary between agent and Go API.                |
| [`prog-strength-agent`][agent]   | FastAPI + Claude. Streams `/chat` to this app over SSE.                              |
| [`prog-strength-mobile`][mobile] | React Native client. Shares the API + agent contracts with this repo.                |
| [`prog-strength-docs`][docs]     | SOWs (statements of work) that drive every cross-repo dispatch.                      |

A change that touches more than one repo lands as a SOW in `prog-strength-docs/sows/` first and then
dispatches through [`prog-strength-developer`][developer] to open per-repo implementation PRs.

[api]: https://github.com/Prog-Strength/prog-strength-api
[mcp]: https://github.com/Prog-Strength/prog-strength-mcp
[agent]: https://github.com/Prog-Strength/prog-strength-agent
[mobile]: https://github.com/Prog-Strength/prog-strength-mobile
[docs]: https://github.com/Prog-Strength/prog-strength-docs
[developer]: https://github.com/Prog-Strength/prog-strength-developer

## Getting started

Requires **Node 20+** (CI runs 20; local dev works on 24). The web app is the thinnest piece of the
stack and can run on its own — but most pages will 401 / empty out until the API is also running.

```bash
git clone https://github.com/Prog-Strength/prog-strength-web.git
cd prog-strength-web
npm ci
cp .env.example .env
npm run dev
```

The app boots at <http://localhost:3000>. With the defaults in `.env.example`, it expects the Go API
at `:8080` and the agent at `:8001` — see [`prog-strength-api`][api] and
[`prog-strength-agent`][agent] for how to bring those up locally. For frontend-only work
(component tweaks, styling, hand-rolled mock data in a page), the dev server still runs without the
backends; login flows just fail.

### Environment

All runtime config is `NEXT_PUBLIC_*` env vars consumed by `lib/config.ts`. See `.env.example` for
the full list with comments; the short version:

| Variable                         | Default                  | Purpose                                                  |
| -------------------------------- | ------------------------ | -------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`            | `http://localhost:8080`  | Go API base URL.                                         |
| `NEXT_PUBLIC_AGENT_URL`          | `http://localhost:8001`  | Agent SSE base URL (used by `/chat`).                    |
| `NEXT_PUBLIC_APP_URL`            | `window.location.origin` | Override for the OAuth `return_to`. Usually leave unset. |
| `NEXT_PUBLIC_BETA_CONTACT_EMAIL` | project owner            | Shown on `/beta-locked` to rejected sign-ins.            |

Auth is Google OAuth issued by the Go API. Successful login deposits a JWT in `localStorage` (see
`lib/auth.ts`); every API call attaches it via `Authorization: Bearer …`.

## Scripts

| Command                | What it does                          |
| ---------------------- | ------------------------------------- |
| `npm run dev`          | Next dev server (Turbopack) at :3000. |
| `npm run build`        | Production build (`next build`).      |
| `npm run start`        | Serve the production build.           |
| `npm run lint`         | ESLint across the repo.               |
| `npm run format`       | Prettier write.                       |
| `npm run format:check` | Prettier check (what CI runs).        |
| `npm run typecheck`    | `tsc --noEmit`.                       |

The Husky `pre-commit` hook runs `lint-staged` (ESLint + Prettier on staged files) and `typecheck`
before letting a commit land — same checks CI runs on the PR.

## Project layout

```
app/
  layout.tsx              Root layout (sidebar shell, theme).
  page.tsx                Landing page (redirects to /workouts when signed in).
  login/                  Google OAuth entry + callback.
  beta-locked/            Shown when a non-allowlisted email signs in.
  (app)/                  Route group for the authenticated app shell.
    bodyweight/           Trend chart + entries table + log/edit/delete modals.
    calendar/             Month view of logged workouts.
    chat/                 Streaming SSE conversation with the agent.
    exercises/            Browsable exercise catalog.
    nutrition/            Daily log + macro rings + Pantry / Recipes catalogs.
    personal-records/     PR list across exercises.
    progress/             Per-exercise progressive-overload charts.
    workouts/             Workouts list + detail page.
components/
  nutrition/              Nutrition-specific subcomponents (log view, pantry view, modals).
  *.tsx                   Cross-page components (sidebar, modals, charts, pills).
lib/
  api.ts                  Typed wrappers over the Go API. One function per endpoint.
  agent.ts                SSE client for the agent's /chat stream.
  auth.ts                 Token storage + sign-out helpers.
  config.ts               NEXT_PUBLIC_* env reads with sensible local-dev defaults.
  format.ts               Number formatting used across charts and tables.
  macro-colors.ts         Shared palette (protein / carbs / fat) for the nutrition surfaces.
  muscle-categories.ts    Muscle-group taxonomy used by workout filters and charts.
public/                   Static assets.
```

A few useful conventions:

- The authenticated routes all live in `app/(app)/` so the shared sidebar layout only renders for
  signed-in pages.
- Heavy components co-locate with their page; cross-page components live under `components/`.
- API calls go through `lib/api.ts` rather than ad-hoc `fetch`. If you need a new endpoint, add the
  wrapper there first.
- Tailwind classes are the default styling vehicle. Component-local CSS is rare and lives in the
  component file when it does appear.

## Working with this codebase

`AGENTS.md` at the repo root flags the most important gotcha for anyone (human or otherwise) coming
in with prior Next.js experience: **this is Next 16**, the App Router has reshaped a lot of APIs,
and the conventions you remember from Next 13/14 may have changed. When in doubt, the canonical
docs are vendored at `node_modules/next/dist/docs/` — read those before guessing.

`CLAUDE.md` re-exports `AGENTS.md` so the same guidance reaches Claude Code sessions.

## CI

`.github/workflows/ci.yml` runs on every PR to `main` and every push to `main`. The job runs, in
order: `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run build`. All four must
pass to merge. There are no unit or integration tests in this repo today; verification is the
type/lint/build trio plus hand-testing in dev.

## Deployment

Production is deployed via [Vercel][vercel] from the `main` branch. Preview deploys are created
automatically for every PR. The Vercel project sets the production `NEXT_PUBLIC_*` env vars to the
public hostnames of the API and agent services running on EC2.

[vercel]: https://vercel.com/

## Contributing

This is a side project — the dispatch flow for cross-repo work goes through SOWs in
[`prog-strength-docs`][docs]. For changes scoped purely to this repo (a component tweak, a styling
fix, a new page), open a PR directly against `main`. The CI gate above is the only required check.
