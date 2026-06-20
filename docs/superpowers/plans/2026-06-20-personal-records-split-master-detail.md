# Personal Records — Split Master-Detail Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the `/personal-records` page from two unrelated grids into one shared two-pane **ledger + detail** layout, for both the Lifts and Running tabs, against real data.

**Architecture:** The page shell (title, `ViewSwitcher`, `Customize`, readiness summary) is preserved. Below it, both tabs render the same `PRLedger` (ranked master list) beside a `PRDetail` (pinned featured estimation chart). Selection is local state, defaulting to the most-due lift / `5k`, preserved per tab. Ranking lives in `readiness.ts`. The featured chart is a new shared `FeaturedEstimateChart` distilled from the existing `ProgressionChart` + `EstimateChart` Recharts code, extended with a dashed reference line. Five now-orphaned per-card components are retired.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4 (CSS-variable tokens), TanStack Query, Recharts, Vitest + Testing Library.

---

## Orientation (read before starting any task)

### Existing data shapes (from `lib/api.ts` — already exist, no API changes)

```ts
type PersonalRecord = {
  exercise_id: string; exercise_name: string; workout_id: string | null;
  weight: number | null; reps: number | null; unit: "lb" | "kg" | null;
  achieved_at: string | null; current_estimated_1rm: number | null;
  estimated_1rm_unit: "lb" | "kg" | null; recent_estimated_1rm_points: number[] | null;
};
type RunningBestEffort = {
  distance_key: string; distance_label: string; distance_meters: number;
  duration_seconds: number; pace_sec_per_km: number;
  activity_id: string; activity_start_time: string;
};
type ExerciseOneRMHistory = {
  exercise_id: string; exercise_name: string; unit: "lb" | "kg";
  points: { workout_id: string; performed_at: string; estimated_1rm: number }[];
};
type RunningMaxEffortDetail = {
  estimator_version: string; distance_key: string; distance_label: string; distance_meters: number;
  estimate: { seconds: number; lower_seconds: number; upper_seconds: number; basis: string;
              confidence: string; n_points: number; n_distances: number } | null;
  actual_best: { seconds: number; activity_id: string; achieved_at: string } | null;
  estimate_history: { as_of: string; seconds: number; lower_seconds: number; upper_seconds: number }[];
  attempts: { activity_id: string; achieved_at: string; duration_seconds: number;
              pace_sec_per_km: number; source: string }[];
  stats: { estimated_max_effort_seconds: number | null; current_best_seconds: number | null;
           gap_seconds: number | null; confidence: string; data_summary: string };
};

// Client fns (already exist):
listPersonalRecords(token): Promise<PersonalRecord[]>
listRunningBestEfforts(token): Promise<RunningBestEffort[]>
getExerciseOneRMHistory(token, exerciseId): Promise<ExerciseOneRMHistory>
getRunningMaxEffort(token, distanceKey): Promise<RunningMaxEffortDetail>
```

### Helpers to REUSE (do not reimplement)

- `./_components/readiness.ts` → `deriveReadiness(record, now?)`, `summarizeReadiness`, `READY_THRESHOLD_PCT`.
- `./_components/format.ts` → `formatWeight(value, unit)`, `formatDate(iso)`.
- `@/lib/format` → `formatDuration(seconds)` ("m:ss" / "h:mm:ss").
- `@/lib/distance-unit-context` → `useDistanceUnit()` returns `{ formatPace(secPerKm), unitLabel }`.
- `./_components/ViewSwitcher` → `ViewSwitcher`, `type PRView` (`"lifts" | "running"`).
- `@/components/headline-exercises-modal` → `HeadlineExercisesModal`.
- `@/app/(app)/progress/running/[distanceKey]/_components/format` → `humanizeConfidence`, `humanizeSource`, `formatSignedDuration`.
- `tooltipContentStyle` from `@/app/(app)/running/_components/HeartRateChart` (Recharts tooltip styling, used by both existing charts).

### The six standard running distances (canonical, shortest first)

```ts
const STANDARD_DISTANCES = [
  { key: "1mi", label: "1 Mile" },
  { key: "2mi", label: "2 Mile" },
  { key: "5k", label: "5K" },
  { key: "10k", label: "10K" },
  { key: "half_marathon", label: "Half Marathon" },
  { key: "marathon", label: "Marathon" },
];
```

This literal currently lives in the retired `RunningView.tsx`. **Move it into `readiness.ts`** (exported as `STANDARD_DISTANCES`) so it survives the retirement and the ledger/detail/default-selection logic share one source. (The identical list in `progress/running/[distanceKey]/_components/distances.ts` is a _separate_ file for a different route — leave it untouched.)

### Design tokens (use these CSS vars verbatim — all verified present in `app/globals.css`)

`--discipline-lift-dot`, `--discipline-run-dot`, `--warning`, `--success`, `--faint`, `--muted`, `--foreground`, `--accent`, `--accent-soft`, `--accent-fg`, `--accent-line`, `--surface`, `--surface-2`, `--border`, `--danger`.

**Token rules (from the SOW + design-system v0.4):**

- The periwinkle `--accent` / `--accent-soft` appears **only** as selection chrome (the selected ledger row). Never as a status/activity color.
- Status dot color: `--faint` when untested/uncovered → `--warning` when "due" (lift `ready`) → discipline dot otherwise (`--discipline-lift-dot` for lifts, `--discipline-run-dot` for running).
- **Do not "fix" the fact that `--discipline-lift-dot` resolves to the same hex as `--accent` in `globals.css`.** That drift is pre-existing, the SOW names `--discipline-lift-dot` as the token to use, and token changes are an explicit non-goal. Reference the semantic token, not a raw hex.
- Charts: prefer `var(--…)` tokens for strokes/grids/fills over raw hex. Recharts accepts CSS-variable strings as SVG presentation attributes (e.g. `stroke="var(--discipline-lift-dot)"`).

### File structure after this plan

```
app/(app)/personal-records/
  page.tsx                         MODIFIED — ledger+detail layout, selLift/selRun state
  page.test.tsx                    MODIFIED — new layout assertions
  _components/
    readiness.ts                   MODIFIED — + STANDARD_DISTANCES, liftsByReadiness, runningByReadiness, RunningLedgerItem
    readiness.test.ts              MODIFIED — + ranking tests
    format.ts                      unchanged
    ViewSwitcher.tsx / .test.tsx   unchanged
    FeaturedEstimateChart.tsx      NEW — shared Recharts chart (line + area + dashed ref + optional band)
    FeaturedEstimateChart.test.tsx NEW
    PRLedger.tsx                   NEW — master list (both tabs) + LedgerRow
    PRLedger.test.tsx              NEW
    PRDetail.tsx                   NEW — dispatches LiftDetail / RunDetail, lazy detail queries
    PRDetail.test.tsx              NEW
    LiftsView.tsx / .test.tsx      DELETED (retired)
    RunningView.tsx                DELETED (retired)
    RunningPRCard.tsx / .test.tsx  DELETED (retired)
    ExpandChevron.tsx              DELETED (retired)
    Sparkline.tsx                  DELETED (retired)
    ProgressionChart.tsx           DELETED (orphaned after LiftsView/RunningPRCard go; logic absorbed into FeaturedEstimateChart)
```

`progress/running/[distanceKey]/_components/EstimateChart.tsx` is **kept** — the running detail _page_ still uses it and is out of scope.

### Per-task discipline (every task)

- TDD: write the failing test first, watch it fail, implement minimally, watch it pass.
- After implementing, run the full local gate and confirm green before committing:
  `npm run typecheck && npm run lint && npm run test`
- Commit with a Conventional Commit (`feat(personal-records): …` etc.). The Husky `pre-commit` hook runs lint-staged + `tsc`; **never** use `--no-verify`.
- Tests render client components inside `QueryClientProvider` + `DistanceUnitProvider` and mock `next/navigation`, `@/lib/auth`, and `@/lib/api` — follow the pattern in `page.test.tsx`.

---

## Task 1: Readiness ranking helpers + standard distances

**Files:**

- Modify: `app/(app)/personal-records/_components/readiness.ts`
- Test: `app/(app)/personal-records/_components/readiness.test.ts`

Add (a) the `STANDARD_DISTANCES` constant (moved from `RunningView.tsx`), (b) `liftsByReadiness`, (c) the `RunningLedgerItem` type + `runningByReadiness`, so "most due first" / "best efforts" ordering is defined once and unit-tested. Pure, React-free, deterministic `now`.

- [ ] **Step 1: Write the failing tests** — append to `readiness.test.ts`:

```ts
import {
  liftsByReadiness,
  runningByReadiness,
  STANDARD_DISTANCES,
  type RunningLedgerItem,
} from "./readiness";

describe("liftsByReadiness", () => {
  const mk = (id: string, weight: number | null, est: number | null): PersonalRecord => ({
    ...base,
    exercise_id: id,
    exercise_name: id,
    workout_id: weight === null ? null : "wk",
    weight,
    current_estimated_1rm: est,
  });

  it("orders tested lifts by descending gap (most over PR first)", () => {
    const out = liftsByReadiness([mk("a", 300, 305), mk("b", 300, 360), mk("c", 300, 330)], NOW);
    expect(out.map((r) => r.exercise_id)).toEqual(["b", "c", "a"]);
  });

  it("sinks untested lifts to the bottom in stable name order", () => {
    const out = liftsByReadiness(
      [mk("z", null, null), mk("a", 300, 330), mk("y", null, null)],
      NOW,
    );
    expect(out.map((r) => r.exercise_id)).toEqual(["a", "z", "y"]);
  });

  it("does not mutate the input array", () => {
    const input = [mk("a", 300, 305), mk("b", 300, 360)];
    const copy = [...input];
    liftsByReadiness(input, NOW);
    expect(input).toEqual(copy);
  });
});

describe("runningByReadiness", () => {
  const item = (key: string, covered: boolean): RunningLedgerItem => ({
    key,
    label: key,
    best: covered
      ? {
          distance_key: key,
          distance_label: key,
          distance_meters: 1,
          duration_seconds: 600,
          pace_sec_per_km: 120,
          activity_id: "a",
          activity_start_time: "2026-01-01T00:00:00Z",
        }
      : null,
  });

  it("ranks 5k first, then covered distances, then uncovered — stable within a rank", () => {
    const out = runningByReadiness([
      item("1mi", false),
      item("5k", false),
      item("10k", true),
      item("2mi", true),
      item("marathon", false),
    ]);
    expect(out.map((r) => r.key)).toEqual(["5k", "10k", "2mi", "1mi", "marathon"]);
  });

  it("includes one row per standard distance the caller passes", () => {
    const items = STANDARD_DISTANCES.map((d) => item(d.key, false));
    expect(runningByReadiness(items)).toHaveLength(6);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run app/\(app\)/personal-records/_components/readiness.test.ts`
Expected: FAIL — `liftsByReadiness`/`runningByReadiness`/`STANDARD_DISTANCES` are not exported.

- [ ] **Step 3: Implement** — append to `readiness.ts`:

```ts
/** The fixed v1 running distance set, shortest first — matches the API's
 * `distance_key`/`distance_label`. Owned here (moved off the retired
 * RunningView) so the ledger, detail, and default-selection logic share one
 * source. The same list also lives in progress/running's `distances.ts` for
 * a different route — that copy is intentionally separate. */
export const STANDARD_DISTANCES: { key: string; label: string }[] = [
  { key: "1mi", label: "1 Mile" },
  { key: "2mi", label: "2 Mile" },
  { key: "5k", label: "5K" },
  { key: "10k", label: "10K" },
  { key: "half_marathon", label: "Half Marathon" },
  { key: "marathon", label: "Marathon" },
];

/**
 * Lifts ranked "most due first": tested lifts by descending est-vs-PR gap,
 * then untested lifts (no PR) last in their original (stable) order. Returns
 * a new array; the input is not mutated. The ledger consumes this so the top
 * row is always the lift most worth a new max attempt.
 */
export function liftsByReadiness(
  records: PersonalRecord[],
  now: Date = new Date(),
): PersonalRecord[] {
  return records
    .map((record, index) => ({ record, index, d: deriveReadiness(record, now) }))
    .sort((a, b) => {
      if (a.d.hasPR !== b.d.hasPR) return a.d.hasPR ? -1 : 1; // tested before untested
      if (a.d.hasPR) {
        const gapA = a.d.gap ?? 0;
        const gapB = b.d.gap ?? 0;
        if (gapA !== gapB) return gapB - gapA; // larger gap first
      }
      return a.index - b.index; // stable within a tier
    })
    .map((x) => x.record);
}

/** One running-ledger row: a standard distance plus the user's best effort at
 * it (null when never covered). */
export type RunningLedgerItem = {
  key: string;
  label: string;
  best: RunningBestEffort | null;
};

/**
 * Running rows ranked: `5k` (the default, always-projected distance) first,
 * then covered distances, then uncovered — stable within each rank, so the
 * caller's canonical shortest-first input order is preserved within a tier.
 * Returns a new array; the input is not mutated.
 */
export function runningByReadiness(items: RunningLedgerItem[]): RunningLedgerItem[] {
  const rank = (it: RunningLedgerItem): number => {
    if (it.key === "5k") return 0;
    if (it.best !== null) return 1;
    return 2;
  };
  return items
    .map((it, index) => ({ it, index }))
    .sort((a, b) => rank(a.it) - rank(b.it) || a.index - b.index)
    .map((x) => x.it);
}
```

Add `RunningBestEffort` to the existing `import type { PersonalRecord } from "@/lib/api";` line:

```ts
import type { PersonalRecord, RunningBestEffort } from "@/lib/api";
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run app/\(app\)/personal-records/_components/readiness.test.ts`
Expected: PASS (all old + new readiness tests).

- [ ] **Step 5: Full gate + commit**

```bash
npm run typecheck && npm run lint && npm run test
git add app/\(app\)/personal-records/_components/readiness.ts app/\(app\)/personal-records/_components/readiness.test.ts
git commit -m "feat(personal-records): add ledger ranking helpers and standard-distance set"
```

---

## Task 2: FeaturedEstimateChart (shared featured chart)

**Files:**

- Create: `app/(app)/personal-records/_components/FeaturedEstimateChart.tsx`
- Test: `app/(app)/personal-records/_components/FeaturedEstimateChart.test.tsx`

A single shared Recharts chart used by both detail panes, distilled from `ProgressionChart` (lift est-1RM line) and `EstimateChart` (running confidence band). It adds the one capability the variant needs over the shipped charts: a **dashed horizontal reference line** at the logged PR / best. "Up is better" (lifts) vs "down is faster" (running) is a prop. The latest point is emphasized in `--warning`.

**Component contract:**

```ts
export type FeaturedPoint = {
  t: number; // epoch ms (X)
  value: number; // metric (Y): est-1RM (lift) or estimate seconds (run)
  lower?: number; // band floor (running only)
  upper?: number; // band ceiling (running only)
};

export type FeaturedEstimateChartProps = {
  data: FeaturedPoint[];
  referenceValue: number; // dashed line height (logged PR weight / best seconds)
  referenceLabel: string; // e.g. "logged PR 305 lb" / "logged best 19:45"
  formatY: (v: number) => string; // Y tick + tooltip formatter
  hasBand?: boolean; // render the confidence band (running)
  lowerIsFasterNote?: boolean; // show the "lower is faster" caption (running)
  lineColor?: string; // CSS var string; default "var(--discipline-lift-dot)"
  isPending?: boolean;
  isError?: boolean;
};
```

**Behavioral spec:**

- `isPending` → an `aria-hidden` animated skeleton box (height 240) — mirror `EstimateChart`'s pending state.
- `isError` → `<p>Couldn't load history</p>` muted.
- `data.length === 0` → `<p>No history yet</p>` muted.
- `data.length === 1` → a single-point summary: a `--warning` dot, the formatted value, the date, and a muted "Not enough data yet" — mirror the existing `SinglePoint` components.
- `data.length >= 2` → a `ResponsiveContainer` > `ComposedChart`:
  - When `hasBand`, two stacked `Area`s (transparent floor `dataKey="lower"`, gradient band `dataKey="height"` where `height = max(0, upper - lower)`) — same technique as `EstimateChart`. Compute the `{lower, height}` fields by mapping `data` inside the component.
  - A `Line dataKey="value"` in `lineColor`, `dot` render-prop that emphasizes only the **last** point with a `--warning` filled circle (`r=4`) and renders nothing for other points.
  - A dashed `ReferenceLine y={referenceValue}` (`stroke="var(--faint)"`, `strokeDasharray="4 4"`) with a `label` of `referenceLabel` (small, `var(--muted)`, positioned `insideTopLeft`).
  - `CartesianGrid stroke="var(--border)" strokeDasharray="3 3"`, `XAxis` time-scaled with the `dateTick` formatter (`"Apr 18"`), `YAxis domain={["dataMin", "dataMax"]} tickFormatter={formatY}`. **Important:** widen the Y domain to include `referenceValue` so the dashed line is always visible — use `domain={[(min) => Math.min(min, referenceValue), (max) => Math.max(max, referenceValue)]}`.
  - `Tooltip` using `tooltipContentStyle`, `labelFormatter` = date, `formatter` = `formatY`.
  - `isAnimationActive={false}` on all series (keeps tests deterministic).
- `lowerIsFasterNote` → a `<p>lower is faster</p>` caption under the title area.

Copy the local `durationTick`/`dateTick` helpers' _shape_ but the component receives `formatY` from the caller (lift → integer rounding; run → "m:ss"); only `dateTick` lives inside.

- [ ] **Step 1: Write the failing test** — `FeaturedEstimateChart.test.tsx`. Recharts needs width; tests assert on the always-rendered DOM (title, reference label, notes, states), and stub `ResponsiveContainer` so the SVG layout renders in jsdom. Follow this shape:

```ts
/// <reference types="vitest/globals" />
import { render, screen } from "@testing-library/react";
import { FeaturedEstimateChart, type FeaturedPoint } from "./FeaturedEstimateChart";

// Recharts' ResponsiveContainer reports 0×0 in jsdom; force a fixed size so
// child series mount and labels render.
vi.mock("recharts", async (orig) => {
  const mod = await orig<typeof import("recharts")>();
  return {
    ...mod,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 600, height: 240 }}>{children}</div>
    ),
  };
});

const series: FeaturedPoint[] = [
  { t: new Date("2026-01-04").getTime(), value: 305 },
  { t: new Date("2026-02-11").getTime(), value: 312 },
  { t: new Date("2026-04-01").getTime(), value: 320 },
];

const fmt = (v: number) => String(Math.round(v));

describe("FeaturedEstimateChart", () => {
  it("renders the dashed reference line label", () => {
    render(<FeaturedEstimateChart data={series} referenceValue={305} referenceLabel="logged PR 305 lb" formatY={fmt} />);
    expect(screen.getByText("logged PR 305 lb")).toBeInTheDocument();
  });

  it("shows the lower-is-faster note only for running", () => {
    const { rerender } = render(
      <FeaturedEstimateChart data={series} referenceValue={305} referenceLabel="r" formatY={fmt} />,
    );
    expect(screen.queryByText("lower is faster")).toBeNull();
    rerender(
      <FeaturedEstimateChart data={series} referenceValue={305} referenceLabel="r" formatY={fmt} lowerIsFasterNote />,
    );
    expect(screen.getByText("lower is faster")).toBeInTheDocument();
  });

  it("renders the single-point state with the value and 'Not enough data yet'", () => {
    render(<FeaturedEstimateChart data={[series[0]]} referenceValue={305} referenceLabel="r" formatY={fmt} />);
    expect(screen.getByText("305")).toBeInTheDocument();
    expect(screen.getByText("Not enough data yet")).toBeInTheDocument();
  });

  it("renders the pending skeleton", () => {
    const { container } = render(
      <FeaturedEstimateChart data={[]} referenceValue={0} referenceLabel="r" formatY={fmt} isPending />,
    );
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
  });

  it("renders a band datum path when hasBand is set", () => {
    const band: FeaturedPoint[] = series.map((p) => ({ ...p, lower: p.value - 5, upper: p.value + 5 }));
    const { container } = render(
      <FeaturedEstimateChart data={band} referenceValue={310} referenceLabel="r" formatY={fmt} hasBand lowerIsFasterNote />,
    );
    // Two stacked Areas (floor + band) → at least one recharts-area layer present.
    expect(container.querySelector(".recharts-area")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run app/\(app\)/personal-records/_components/FeaturedEstimateChart.test.tsx`
Expected: FAIL — module/component does not exist.

- [ ] **Step 3: Implement `FeaturedEstimateChart.tsx`** per the contract above. Reference implementations to mirror closely: `ProgressionChart.tsx` (axes, `dateTick`, `SinglePoint`) and `EstimateChart.tsx` (stacked-area band via `defs` gradient + two `Area`s, `tooltipContentStyle` import). Use a `ComposedChart` so the band, line, and reference coexist. Title block: a small uppercase muted label (passed implicitly — the detail panes own headings, so this component renders no title text beyond the optional "lower is faster" note; keep it chrome-light). The latest-point emphasis:

```tsx
const lastIndex = data.length - 1;
// ...
<Line
  dataKey="value"
  stroke={lineColor ?? "var(--discipline-lift-dot)"}
  strokeWidth={2}
  isAnimationActive={false}
  dot={(props) =>
    props.index === lastIndex ? (
      <circle
        key={props.index}
        cx={props.cx}
        cy={props.cy}
        r={4}
        fill="var(--warning)"
        stroke="none"
      />
    ) : (
      <g key={props.index} /> // render nothing for non-latest points
    )
  }
/>;
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run app/\(app\)/personal-records/_components/FeaturedEstimateChart.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full gate + commit**

```bash
npm run typecheck && npm run lint && npm run test
git add app/\(app\)/personal-records/_components/FeaturedEstimateChart.tsx app/\(app\)/personal-records/_components/FeaturedEstimateChart.test.tsx
git commit -m "feat(personal-records): add shared FeaturedEstimateChart with dashed reference line"
```

---

## Task 3: PRLedger master list + rows

**Files:**

- Create: `app/(app)/personal-records/_components/PRLedger.tsx`
- Test: `app/(app)/personal-records/_components/PRLedger.test.tsx`

The master pane: a ranked, keyboard-navigable list of rows for the active tab, with a section label and loading/error/empty states. One `LedgerRow` component parameterized by tab keeps the two row idioms together. **Selection is driven by props** (`selectedId` + `onSelect`); the ledger owns no fetching.

**Component contract:**

```ts
type LedgerState = "pending" | "error" | "ready";

export type PRLedgerProps = {
  view: PRView; // "lifts" | "running"
  lifts?: PersonalRecord[]; // present when view==="lifts"
  running?: RunningLedgerItem[]; // present when view==="running" (already merged: all 6 distances)
  state: LedgerState;
  errorMessage?: string | null;
  selectedId: string | null; // exercise_id (lifts) | distance key (running)
  onSelect: (id: string) => void;
};
```

**Behavioral spec:**

- `state === "error"` → the standard danger box (`border-[var(--danger)]/40 bg-[var(--danger)]/10`) with `errorMessage`.
- `state === "pending"` → a short stack of `animate-pulse` skeleton rows (`aria-hidden`).
- Lifts, `ready`, empty list → `<p>No headline lifts configured.</p>` muted.
- Section label (uppercase, `text-[11px]`, `--faint`): `"Most due first"` (lifts) / `"Best efforts"` (running).
- Ranking: lifts via `liftsByReadiness`, running via `runningByReadiness` (consume Task 1 — do not re-sort inline).
- Each row is a real `<button type="button">` inside an `<li>`; the `<ul>` has an accessible label. **Selectability:**
  - Lift row selectable when `deriveReadiness(r).hasPR`. Untested lifts (`!hasPR`) render dimmed (`opacity-60`), `disabled`, no `onClick`.
  - Running row selectable when `best !== null || key === "5k"` (5k is the always-projected default). Other uncovered distances render dimmed + `disabled`.
- Row anatomy (single compact line, `flex items-center justify-between`):
  - **Status dot** (`h-2 w-2 rounded-full`): `--faint` when not selectable (untested/uncovered) → `--warning` when lift `ready` → discipline dot (`--discipline-lift-dot` / `--discipline-run-dot`).
  - **Name** + **secondary stat**: lift → `formatWeight(weight, unit)` (with ` ea` when `isDumbbell`) ; running → `formatPace(pace_sec_per_km) + "/" + unitLabel` (via `useDistanceUnit`), or `"—"` when uncovered.
  - **Right figure** (right-aligned, `tabular-nums`): lift → current est-1RM rounded; running → `formatDuration(duration_seconds)` or `"—"`.
  - **Cue**: lift `ready` → `+{round(gap)}` in `--warning`. (Running per-row reach cue is intentionally omitted — the projection isn't loaded at ledger time under the SOW's lazy-per-selection data model; the detail pane carries the "PR in reach" cue. Document this in the row comment.)
  - Selected row chrome: `border-l-2 border-[var(--accent)] bg-[var(--accent-soft)]`. `aria-current={selected ? "true" : undefined}` and an `aria-label` naming the record and its figure (e.g. `"Back Squat, est 1RM 410"`).
- Keyboard: native `<button>`s are tab-focusable and Enter/Space-activatable for free — no custom key handling needed beyond that.

- [ ] **Step 1: Write the failing test** — `PRLedger.test.tsx`. Render inside `DistanceUnitProvider` (the running rows call `useDistanceUnit`). No network mocks needed (ledger is presentational).

```ts
/// <reference types="vitest/globals" />
import { render, screen, fireEvent } from "@testing-library/react";
import { DistanceUnitProvider } from "@/lib/distance-unit-context";
import type { PersonalRecord } from "@/lib/api";
import { PRLedger } from "./PRLedger";
import { STANDARD_DISTANCES, type RunningLedgerItem } from "./readiness";

vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  getMe: vi.fn(async () => { throw new Error("no /me"); }),
}));

const mkLift = (id: string, weight: number | null, est: number | null): PersonalRecord => ({
  exercise_id: id, exercise_name: id, workout_id: weight === null ? null : "wk",
  weight, reps: 3, unit: "lb", achieved_at: "2026-04-01T00:00:00Z",
  current_estimated_1rm: est, estimated_1rm_unit: "lb", recent_estimated_1rm_points: null,
});

const lifts = [mkLift("Bench", 300, 305), mkLift("Squat", 300, 360), mkLift("Deadlift", null, null)];

const runItems: RunningLedgerItem[] = STANDARD_DISTANCES.map((d) => ({
  key: d.key, label: d.label,
  best: d.key === "5k" || d.key === "10k"
    ? { distance_key: d.key, distance_label: d.label, distance_meters: 1, duration_seconds: 1184.7,
        pace_sec_per_km: 236.9, activity_id: "a", activity_start_time: "2026-04-18T00:00:00Z" }
    : null,
}));

const wrap = (ui: React.ReactElement) => render(<DistanceUnitProvider>{ui}</DistanceUnitProvider>);

describe("PRLedger lifts", () => {
  it("ranks the most-due lift to the top row", () => {
    wrap(<PRLedger view="lifts" lifts={lifts} state="ready" selectedId="Squat" onSelect={() => {}} />);
    const rows = screen.getAllByRole("button");
    expect(rows[0]).toHaveTextContent("Squat"); // biggest gap (300→360)
  });

  it("renders the untested lift dimmed and non-selectable", () => {
    wrap(<PRLedger view="lifts" lifts={lifts} state="ready" selectedId="Squat" onSelect={() => {}} />);
    const deadlift = screen.getByText("Deadlift").closest("button")!;
    expect(deadlift).toBeDisabled();
  });

  it("fires onSelect and marks aria-current on the selected row", () => {
    const onSelect = vi.fn();
    wrap(<PRLedger view="lifts" lifts={lifts} state="ready" selectedId="Squat" onSelect={onSelect} />);
    fireEvent.click(screen.getByText("Bench").closest("button")!);
    expect(onSelect).toHaveBeenCalledWith("Bench");
    expect(screen.getByText("Squat").closest("button")).toHaveAttribute("aria-current", "true");
  });

  it("shows the empty state when there are no lifts", () => {
    wrap(<PRLedger view="lifts" lifts={[]} state="ready" selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText("No headline lifts configured.")).toBeInTheDocument();
  });

  it("shows the error box", () => {
    wrap(<PRLedger view="lifts" state="error" errorMessage="boom" selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText("boom")).toBeInTheDocument();
  });
});

describe("PRLedger running", () => {
  it("ranks 5k first and dims uncovered distances", () => {
    wrap(<PRLedger view="running" running={runItems} state="ready" selectedId="5k" onSelect={() => {}} />);
    const rows = screen.getAllByRole("button");
    expect(rows[0]).toHaveTextContent("5K");
    expect(screen.getByText("Marathon").closest("button")).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run app/\(app\)/personal-records/_components/PRLedger.test.tsx`
Expected: FAIL — `PRLedger` does not exist.

- [ ] **Step 3: Implement `PRLedger.tsx`** per the contract. Keep `LedgerRow` (and any `LiftRow`/`RunRow` split you prefer) in the same file — they share the row chrome. Import `liftsByReadiness`, `runningByReadiness`, `deriveReadiness`, `READY_THRESHOLD_PCT` from `./readiness`; `formatWeight` from `./format`; `formatDuration` from `@/lib/format`; `useDistanceUnit` from `@/lib/distance-unit-context`; `type PRView` from `./ViewSwitcher`. `"use client"` at the top.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run app/\(app\)/personal-records/_components/PRLedger.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full gate + commit**

```bash
npm run typecheck && npm run lint && npm run test
git add app/\(app\)/personal-records/_components/PRLedger.tsx app/\(app\)/personal-records/_components/PRLedger.test.tsx
git commit -m "feat(personal-records): add ranked PRLedger master list"
```

---

## Task 4: PRDetail + LiftDetail + RunDetail (pinned detail pane)

**Files:**

- Create: `app/(app)/personal-records/_components/PRDetail.tsx`
- Test: `app/(app)/personal-records/_components/PRDetail.test.tsx`

The detail pane, always present, showing the selected record's featured estimation chart and headline numbers. `PRDetail` switches on `view`, fetching the detail series lazily via TanStack Query (fires on first selection, cached for the page lifetime). Keep `LiftDetail` and `RunDetail` in the same file.

**Component contract:**

```ts
export type PRDetailProps = {
  view: PRView;
  liftRecord: PersonalRecord | null; // the selected lift row (headline numbers come from here — no second fetch)
  distanceKey: string | null; // the selected running distance
  distanceLabel: string | null;
};
```

**LiftDetail spec** (when `view==="lifts"` and `liftRecord`):

- Lazy query: `useQuery({ queryKey: ["pr-history", "lifts", liftRecord.exercise_id], queryFn: () => getExerciseOneRMHistory(getToken() ?? "", liftRecord.exercise_id) })`.
- If `!deriveReadiness(liftRecord).hasPR` → empty state: `"Log a heavy set on this lift to start its estimate."` (no chart, no query needed — but it's fine if the query is disabled in this branch; prefer `enabled: hasPR`).
- Heading: `"Estimated 1RM · progress toward a new max"` (small uppercase muted).
- Exercise name (prominent), logged-PR subline: `formatWeight(weight, unit)` · `{reps} reps` (append ` ea` dumbbell modifier when `deriveReadiness(r).isDumbbell`) · `formatDate(achieved_at)`.
- Large current est-1RM figure (`text-3xl tabular-nums`): `Math.round(current_estimated_1rm)` + unit.
- When `deriveReadiness(r).ready`: a `--warning` cue `"+{round(gap)} over PR — go for a max"`.
- Featured chart: map `history.points` → `FeaturedPoint{ t: Date(performed_at).getTime(), value: estimated_1rm }`; `referenceValue = liftRecord.weight`; `referenceLabel = "logged PR " + formatWeight(weight, unit)`; `formatY = (v) => String(Math.round(v))`; `lineColor="var(--discipline-lift-dot)"`; pass `isPending`/`isError` from the query.

**RunDetail spec** (when `view==="running"` and `distanceKey`):

- Lazy query: `useQuery({ queryKey: ["running-max-effort", distanceKey], queryFn: () => getRunningMaxEffort(getToken() ?? "", distanceKey), staleTime: 60_000 })`.
- `insufficient = !detail || detail.estimate === null || detail.estimate.basis === "insufficient_data"` → the insufficient empty state (reuse the running detail page's copy shape): title `"Not enough data yet"`, body referencing the distance label.
- Heading: `"Max-effort estimate · progress toward a new best"`.
- Distance label (prominent), subline: confidence (`humanizeConfidence(estimate.confidence)`) · band (`formatDuration(lower_seconds)–formatDuration(upper_seconds)`) · logged best (`actual_best ? formatDuration(actual_best.seconds) : "—"`).
- Large estimate figure: `formatDuration(estimate.seconds)`.
- When `actual_best` and `estimate.seconds < actual_best.seconds`: a `--warning`/`--success` cue `"under best — PR in reach"`.
- Featured chart: map `estimate_history` → `FeaturedPoint{ t: Date(as_of).getTime(), value: seconds, lower: lower_seconds, upper: upper_seconds }`; `referenceValue = actual_best?.seconds ?? estimate.seconds`; `referenceLabel = "logged best " + (actual_best ? formatDuration(actual_best.seconds) : "—")`; `formatY = formatDuration`; `hasBand`; `lowerIsFasterNote`; `lineColor="var(--discipline-run-dot)"`.
- Recent attempts as chips: map `attempts.slice(0, 5)` → rounded-full `--surface-2` chips showing `formatDuration(duration_seconds)` + `humanizeSource(source)`.
- A `"View full estimate →"` `next/link` to `/progress/running/{distanceKey}`.
- When nothing selected (`distanceKey === null` / `liftRecord === null`) → a quiet `"Select a record to see its estimate."` placeholder.

- [ ] **Step 1: Write the failing test** — `PRDetail.test.tsx`. Mock `@/lib/api` (`getExerciseOneRMHistory`, `getRunningMaxEffort`), `@/lib/auth`, and render inside `QueryClientProvider` + `DistanceUnitProvider` (mirror `page.test.tsx`). Cover: lift figure + "+N over PR" cue when due; lift empty state for an untested record; run estimate + band + attempts for a projected distance; run insufficient state otherwise.

```ts
/// <reference types="vitest/globals" />
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DistanceUnitProvider } from "@/lib/distance-unit-context";
import type { PersonalRecord, ExerciseOneRMHistory, RunningMaxEffortDetail } from "@/lib/api";

vi.mock("recharts", async (orig) => {
  const mod = await orig<typeof import("recharts")>();
  return { ...mod, ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div style={{ width: 600, height: 240 }}>{children}</div>) };
});
vi.mock("@/lib/auth", () => ({ getToken: () => "t", clearToken: vi.fn() }));
vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  getMe: vi.fn(async () => { throw new Error("no /me"); }),
  getExerciseOneRMHistory: vi.fn(async () => HISTORY),
  getRunningMaxEffort: vi.fn(async () => RUN_DETAIL),
}));

import { PRDetail } from "./PRDetail";

const HISTORY: ExerciseOneRMHistory = {
  exercise_id: "Bench", exercise_name: "Bench", unit: "lb",
  points: [
    { workout_id: "a", performed_at: "2026-01-04T00:00:00Z", estimated_1rm: 305 },
    { workout_id: "b", performed_at: "2026-03-01T00:00:00Z", estimated_1rm: 330 },
  ],
};
const RUN_DETAIL: RunningMaxEffortDetail = {
  estimator_version: "v1", distance_key: "5k", distance_label: "5K", distance_meters: 5000,
  estimate: { seconds: 1170, lower_seconds: 1150, upper_seconds: 1200, basis: "fit", confidence: "high", n_points: 5, n_distances: 3 },
  actual_best: { seconds: 1184, activity_id: "a", achieved_at: "2026-04-18T00:00:00Z" },
  estimate_history: [
    { as_of: "2026-02-01T00:00:00Z", seconds: 1200, lower_seconds: 1180, upper_seconds: 1230 },
    { as_of: "2026-04-01T00:00:00Z", seconds: 1170, lower_seconds: 1150, upper_seconds: 1200 },
  ],
  attempts: [{ activity_id: "a", achieved_at: "2026-04-18T00:00:00Z", duration_seconds: 1184, pace_sec_per_km: 236, source: "race_like" }],
  stats: { estimated_max_effort_seconds: 1170, current_best_seconds: 1184, gap_seconds: -14, confidence: "high", data_summary: "5 efforts" },
};

const due: PersonalRecord = {
  exercise_id: "Bench", exercise_name: "Bench", workout_id: "wk", weight: 300, reps: 3, unit: "lb",
  achieved_at: "2026-03-01T00:00:00Z", current_estimated_1rm: 330, estimated_1rm_unit: "lb", recent_estimated_1rm_points: null,
};
const untested: PersonalRecord = { ...due, exercise_id: "Deadlift", exercise_name: "Deadlift", workout_id: null, weight: null, current_estimated_1rm: null };

const wrap = (ui: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  return render(<QueryClientProvider client={client}><DistanceUnitProvider>{ui}</DistanceUnitProvider></QueryClientProvider>);
};

describe("PRDetail lift", () => {
  it("shows the est-1RM figure and the +N over PR cue when due", async () => {
    wrap(<PRDetail view="lifts" liftRecord={due} distanceKey={null} distanceLabel={null} />);
    expect(await screen.findByText(/330/)).toBeInTheDocument();
    expect(screen.getByText(/over PR — go for a max/)).toBeInTheDocument();
  });
  it("shows the empty state for an untested lift", () => {
    wrap(<PRDetail view="lifts" liftRecord={untested} distanceKey={null} distanceLabel={null} />);
    expect(screen.getByText(/Log a heavy set/)).toBeInTheDocument();
  });
});

describe("PRDetail run", () => {
  it("shows the estimate, band subline, and attempt chips for a projected distance", async () => {
    wrap(<PRDetail view="running" liftRecord={null} distanceKey="5k" distanceLabel="5K" />);
    expect(await screen.findByText(/19:30/)).toBeInTheDocument();    // 1170s estimate
    expect(screen.getByText(/Race-like/)).toBeInTheDocument();       // attempt chip
    expect(screen.getByText(/in reach/)).toBeInTheDocument();        // 1170 < 1184
  });
  it("shows the insufficient state when there is no estimate", async () => {
    vi.mocked((await import("@/lib/api")).getRunningMaxEffort).mockResolvedValueOnce({ ...RUN_DETAIL, estimate: null });
    wrap(<PRDetail view="running" liftRecord={null} distanceKey="marathon" distanceLabel="Marathon" />);
    expect(await screen.findByText(/Not enough data yet/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run app/\(app\)/personal-records/_components/PRDetail.test.tsx`
Expected: FAIL — `PRDetail` does not exist.

- [ ] **Step 3: Implement `PRDetail.tsx`** (with `LiftDetail`, `RunDetail` co-located) per the contract. `"use client"`. Use `FeaturedEstimateChart` from Task 2. Reuse `deriveReadiness`/`formatWeight`/`formatDate`/`formatDuration`/`useDistanceUnit`/`humanizeConfidence`/`humanizeSource`. Verify `19:30` is what `formatDuration(1170)` produces; if `formatDuration` renders differently, align the test's expected string to the real helper output (read `lib/format.ts`) rather than forcing the code.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run app/\(app\)/personal-records/_components/PRDetail.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full gate + commit**

```bash
npm run typecheck && npm run lint && npm run test
git add app/\(app\)/personal-records/_components/PRDetail.tsx app/\(app\)/personal-records/_components/PRDetail.test.tsx
git commit -m "feat(personal-records): add pinned PRDetail lift/run estimation panes"
```

---

## Task 5: Restructure page.tsx, retire orphaned components, update page.test.tsx

**Files:**

- Modify: `app/(app)/personal-records/page.tsx`
- Modify: `app/(app)/personal-records/page.test.tsx`
- Delete: `LiftsView.tsx`, `LiftsView.test.tsx`, `RunningView.tsx`, `RunningPRCard.tsx`, `RunningPRCard.test.tsx`, `ExpandChevron.tsx`, `Sparkline.tsx`, `ProgressionChart.tsx` (all under `_components/`).

Wire the page to the new layout and remove the now-orphaned per-card components.

**Page spec:**

- Keep the header chrome verbatim: title, `ViewSwitcher`, the Lifts-only `Customize` button + `HeadlineExercisesModal`, and the `summarizeReadiness` "N due · N/total tested" line.
- Keep the two lazy `useQuery`s (`["personal-records","lifts"]` / `["personal-records","running"]`, `enabled: view === …`).
- Merge running data into ledger items: `const runItems = STANDARD_DISTANCES.map((d) => ({ key: d.key, label: d.label, best: runningQuery.data?.find((e) => e.distance_key === d.key) ?? null }))`.
- Selection state: `const [selLift, setSelLift] = useState<string | null>(null); const [selRun, setSelRun] = useState<string>("5k");` (running always has 5k available; lifts default once data arrives). Initialize `selLift` to the most-due lift when lifts data first arrives and `selLift` is still null:
  ```tsx
  const rankedLifts = liftsQuery.data ? liftsByReadiness(liftsQuery.data) : [];
  const firstTested = rankedLifts.find((r) => deriveReadiness(r).hasPR) ?? null;
  const effectiveSelLift = selLift ?? firstTested?.exercise_id ?? null;
  ```
  Resolve the selected lift record: `const selLiftRecord = liftsQuery.data?.find((r) => r.exercise_id === effectiveSelLift) ?? null;`. Using a derived `effectiveSelLift` (rather than a `useEffect` that sets state) keeps default-selection out of an effect and avoids the `set-state-in-effect` lint warning. `onSelect={setSelLift}` for the ledger.
- Layout: replace the `view === "lifts" ? <LiftsView/> : <RunningView/>` body with:
  ```tsx
  <div className="grid grid-cols-1 gap-6 md:grid-cols-[260px_1fr]">
    <PRLedger
      view={view}
      lifts={liftsQuery.data}
      running={view === "running" ? runItems : undefined}
      state={isPending ? "pending" : isError ? "error" : "ready"}
      errorMessage={errorMessage}
      selectedId={view === "lifts" ? effectiveSelLift : selRun}
      onSelect={view === "lifts" ? setSelLift : setSelRun}
    />
    <PRDetail
      view={view}
      liftRecord={view === "lifts" ? selLiftRecord : null}
      distanceKey={view === "running" ? selRun : null}
      distanceLabel={
        view === "running"
          ? (STANDARD_DISTANCES.find((d) => d.key === selRun)?.label ?? null)
          : null
      }
    />
  </div>
  ```
  where `isPending`/`isError`/`errorMessage` are derived from the active view's query. Below `md` the grid is one column (ledger stacked above detail) — Tailwind's `grid-cols-1` default does this.
- Selection is preserved per tab because `selLift` and `selRun` are independent state, untouched by `ViewSwitcher` toggles (the `?view=` change re-renders but doesn't reset state).

**page.test.tsx updates:**

- The mocked api already returns `LIFTS`/`RUNS`/`HISTORY` and `getExerciseOneRMHistory`. Add a `getRunningMaxEffort` mock returning a projected 5K detail (so the running detail pane renders without throwing). Add the `recharts` `ResponsiveContainer` mock (as in Tasks 2/4).
- Keep/adjust the existing assertions to the new layout:
  - Default view renders lift ledger rows (`Barbell Bench Press`, `Back Squat`) and does **not** call `listRunningBestEfforts`. `listPersonalRecords` called once.
  - `?view=running` renders the running ledger (5K row, the `19:45` best time) and does **not** call `listPersonalRecords`. `listRunningBestEfforts` called once.
  - The lift **detail query fires only on selection**: on load, the most-due lift (`Back Squat`: 405→410 gap 5 vs Bench 305→320 gap 15 — wait, compute: Bench gap=15, Squat gap=5 → most-due is **Barbell Bench Press**) is auto-selected, so `getExerciseOneRMHistory` is called once for the default selection. Assert it's called with the most-due exercise id. (Adjust the fixture or assertion so the "default = most-due" expectation is unambiguous.)
  - Tab switch preserves each tab's selection: select a different lift, switch to running, switch back — the previously selected lift is still current. (Use the mutable `viewParam` + `rerender` pattern already in the file.)
  - Keep the "Customize hidden on running / shown on lifts" and "readiness summary on lifts" tests.
- Remove `LiftsView.test.tsx` and `RunningPRCard.test.tsx` (their components are deleted). There are no standalone `Sparkline`/`ExpandChevron` tests to remove.

- [ ] **Step 1: Update `page.test.tsx`** to the new layout assertions above (write them first so they fail against the current page). Delete `LiftsView.test.tsx` and `RunningPRCard.test.tsx`.

- [ ] **Step 2: Run to verify the updated page test fails**

Run: `npx vitest run app/\(app\)/personal-records/page.test.tsx`
Expected: FAIL — current `page.tsx` still renders the old grid (no ledger/detail).

- [ ] **Step 3: Restructure `page.tsx`** per the spec; **delete** the retired component files:

```bash
git rm app/\(app\)/personal-records/_components/LiftsView.tsx \
       app/\(app\)/personal-records/_components/LiftsView.test.tsx \
       app/\(app\)/personal-records/_components/RunningView.tsx \
       app/\(app\)/personal-records/_components/RunningPRCard.tsx \
       app/\(app\)/personal-records/_components/RunningPRCard.test.tsx \
       app/\(app\)/personal-records/_components/ExpandChevron.tsx \
       app/\(app\)/personal-records/_components/Sparkline.tsx \
       app/\(app\)/personal-records/_components/ProgressionChart.tsx
```

- [ ] **Step 4: Run the full test suite to verify it passes and nothing else broke**

Run: `npm run test`
Expected: PASS (no references to the deleted components remain; grep to confirm: `grep -rn "LiftsView\|RunningPRCard\|ExpandChevron\|Sparkline\|ProgressionChart" app components` returns nothing).

- [ ] **Step 5: Full gate (incl. build) + commit**

```bash
npm run typecheck && npm run lint && npm run test && npm run build
git add -A
git commit -m "feat(personal-records): restructure page into ledger+detail and retire per-card components"
```

---

## Final verification (after all tasks)

- [ ] `npm run typecheck && npm run lint && npm run test && npm run build` all green.
- [ ] `grep -rn "LiftsView\|RunningPRCard\|ExpandChevron\|Sparkline\|ProgressionChart" app/ components/` returns nothing (orphans fully removed; the activities `running-view` is a different path and must NOT appear).
- [ ] Manual smoke checklist for the PR description: dense account (8 lifts incl. an untested Deadlift; 4 covered + 2 uncovered distances), sparse account (1–2 PRs, 1 distance), tab switching preserves selection, mobile single-column stack, keyboard navigation of the ledger.

## Self-Review (controller checklist — done at plan-writing time)

1. **Spec coverage:** page restructure (T5) ✓; PRLedger + rows (T3) ✓; PRDetail/LiftDetail/RunDetail (T4) ✓; FeaturedEstimateChart with dashed reference + band + latest-point emphasis + up/down semantics (T2) ✓; readiness ranking helpers + tests (T1) ✓; data wiring lazy-per-view + lazy-per-selection (T4/T5) ✓; default selection most-due/5k preserved per tab (T5) ✓; responsive `md:grid-cols-[260px_1fr]` (T5) ✓; token usage (all tasks) ✓; retire orphaned components incl. ProgressionChart (T5) ✓; all five test files (T1–T5) ✓.
2. **Known SOW looseness resolved:** the per-row running "PR near" cue requires the projection, which isn't loaded at ledger time under the SOW's lazy-per-selection data model — implemented as: detail pane carries the "PR in reach" cue; ledger omits the per-row reach cue. Documented in T3 and to be called out in the PR body.
3. **Type consistency:** `RunningLedgerItem`, `FeaturedPoint`, `PRLedgerProps`, `PRDetailProps`, `LedgerState` are defined once and referenced consistently across tasks. `liftsByReadiness`/`runningByReadiness`/`STANDARD_DISTANCES` names match between T1 and consumers.
   </content>
   </invoke>
