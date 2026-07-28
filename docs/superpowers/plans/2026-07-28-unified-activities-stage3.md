# Unified Activity Model — Stage 3 (Web) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Checkbox steps.

**Goal:** Migrate prog-strength-web off the deprecated `/workouts/*` shims onto the unified `/activities` surface (SOW stage 3), collapsing the client-side workouts+runs merges into single typed fetches. UI look stays the same; the Activities tab's Overview becomes a true all-types list.

**Ground truth:** API = prog-strength-api branch `feat/unified-activity-model` (PR #79). Read `internal/activity/unified_handler.go` + `handler.go` + `strength/handler.go` for exact shapes. Local API binary for live verification: scratchpad `boot/api-branch` (DEV_AUTH flow: `POST /auth/dev/token`).

**Branching:** web branch `feat/unified-activities` created FROM `fix/harden-running-fetchers` (the hardening PR) — its PR notes it depends on that PR + api PR #79 + the Task-1 parity PR being deployed.

**House rules (AGENTS.md):** this is NOT the Next.js you know — consult `node_modules/next/dist/docs/` for any App-Router API touched; all API calls live in `lib/api.ts`; vitest co-located; typecheck+lint+test+build before done; conventional commits, never `--no-verify`. Dumbbell weights are per-dumbbell (display only — don't touch semantics).

---

### Task 1: API parity additions (in the API repo — prerequisite for everything below)

**Repo:** prog-strength-api, new branch `feat/activities-strength-parity` off `feat/unified-activity-model`. Separate PR, stacked on #79.

Web consumes three things from `/workouts/*` that the unified surface lacks. Add them additively (TDD, house patterns, shims untouched):

- [x] **PR-event embeds**: `GET /workouts` embeds `personal_records_set` per item (bulk `ListPersonalRecordEventsByWorkouts`); `GET /workouts/{id}` returns enrichment + PR context web renders. Read `strength/handler.go`'s list/get DTO construction, then make the unified surface reach parity for strength items: embed the same PR-event payload in the strength `details` object (list: per-item; detail: full), reusing the existing bulk query (extend the strength `BulkDetailLoader` path — no N+1). Field names identical to the legacy DTO so web maps 1:1.
- [x] **`POST /activities/imports`** — alias for `POST /workouts/imports` (create strength session from TCX), mounted via the strength descriptor's `MountRoutes`, same handler/response shape.
- [x] **One-RM history alias** — find the exact legacy path web calls (`lib/api.ts` ~:2501 region names it; confirm in the api router) and mount the equivalent under `/activities/...` preserving shape.
- [x] Full suite + lint green; commit(s); push; `gh pr create` (base: `feat/unified-activity-model`, title "feat: strength parity additions for unified surface", body notes it merges into/after #79).

### Task 2: `lib/api.ts` — unified types + fetchers (TDD, co-located vitest)

- [x] New types: `Activity` (base fields + `activity_type` + optional `summary {title, subtitle, metrics: string[]}` + optional typed `details` — mirror the Go `unifiedReadDTO` exactly), `ActivitiesPage` (verify envelope key + cursor field from the Go list handler), `ActivityPayload` for typed create/update.
- [x] New fetchers: `listActivities` (cursor + range + `type` param — note the existing comment that `/activities` forbids mixing since/until with limit/before), `getActivity`, `createActivity`, `updateActivity`, `deleteActivity`.
- [x] Repoint the workout fetchers to unified equivalents, keeping exported names so consumers change minimally: `listWorkouts` → `listActivities(type=strength_training)` adapter returning the shape its consumers need (pagination model changes from offset/total to cursor — adapt consumers in Task 3, don't fake a total), `getWorkout` → `getActivity` (details.exercises mapped to the existing `Workout` shape web components consume — write an explicit adapter, don't loosen component types), `createWorkout`/`updateWorkout` → typed POST/PUT `/activities`, `deleteWorkout` → `DELETE /activities/{id}`, `listProgression` → `GET /activities/progression`, `createWorkoutFromTCX` → `POST /activities/imports`, `attachWorkoutTCX`/`detachWorkoutTCX` → `POST|DELETE /activities/{id}/tcx`, one-RM history → its new alias.
- [x] Running fetchers: `listRunningSessions` switches to `?type=running` server-side filtering (keep the hardening filter as a belt — one line); types reconciled with the unified `Activity` (RunningSession may stay as the endurance-detail view type; document the relationship).
- [x] Vitest: fetcher-level tests for each new/repointed function (mock fetch; assert URL, method, body mapping, envelope unwrap, adapter output). 401 handling unchanged.

### Task 3: Consumers

> Executed, plus one post-review addition: the Calendar also collapsed its workouts+runs merge onto ONE ranged `listActivities` call so walks/rides keep their day markers (the Running tab stays runs-only by design). All three collapse sites share `lib/partition-activities.ts`.

- [x] `components/activities/activities-overview-view.tsx`: replace the `Promise.all([listWorkouts, listRunningSessions, …])` merge with ONE `listActivities` (all types) + steps fetches; `deriveOverviewStats` + combined chart adapt to `Activity` with type discrimination. Same rendered output (existing tests/fixtures updated to unified fixtures — assert same derived stats).
- [x] `app/(app)/timeline/_components/YourWeekRail.tsx`: same collapse to one `listActivities` ranged call.
- [x] `components/activities/workouts-view.tsx`: strength-filtered list via the repointed `listWorkouts`; adapt pagination UI to cursor model (load-more instead of numbered pages if that's what the data supports — keep it simple and match running-view's existing pattern).
- [x] Workout detail page + edit modals + live/review flow + TCX modal: consume the adapters — target: minimal diffs, identical rendered output incl. PR badges (parity fields from Task 1).
- [x] `WorkoutTimelineSummary.tsx`: `getWorkout` → repointed adapter (no behavior change).
- [x] Routes stay: `/workouts/[id]`, `/running/[id]` URLs unchanged (web-internal naming; not part of this SOW stage).

### Task 4: Verification

- [x] `npm run typecheck && npm run lint && npm run test && npm run build` all green.
- [x] Live smoke against the branch API binary (scratch DB + dev token + `NEXT_PUBLIC_API_URL=http://localhost:8080 npm run dev`): create a lift via the live-workout flow, see it in Activities Overview + Workouts view with PR badge; import behavior unaffected; delete works. Record findings.

### Task 5: PR

- [x] Push; `gh pr create` — title "feat: migrate to unified /activities surface (stage 3)"; body: summary, explicit merge-order block (1. web hardening PR, 2. api PR #79 deploy, 3. api parity PR deploy, 4. this PR), 🤖 footer.

**Conventions:** conventional commits + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` trailer everywhere.
