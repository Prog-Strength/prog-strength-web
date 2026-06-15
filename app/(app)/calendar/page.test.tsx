/// <reference types="vitest/globals" />

import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { DistanceUnitProvider } from "@/lib/distance-unit-context";
import type { Workout, RunningSession, StepsEntry } from "@/lib/api";

// --- module mocks ----------------------------------------------------------

// pushMock is hoisted so the next/navigation factory can close over it and
// the tests can still assert on it.
const pushMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  getToken: () => "test-token",
  clearToken: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));

// Keep the real type exports (Workout, RunningSession, etc.) resolving by
// spreading the actual module, then overriding only the three data fns.
vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  listExercises: vi.fn(async () => []),
  listWorkouts: vi.fn(async () => ({
    items: WORKOUTS,
    total: WORKOUTS.length,
    limit: 100,
    offset: 0,
    has_more: false,
  })),
  listRunningSessions: vi.fn(async () => ({ activities: RUNS, next_before: null })),
  listSteps: vi.fn(async () => ({ steps: STEPS, next_before: null })),
}));

import { listWorkouts, listRunningSessions } from "@/lib/api";
import CalendarPage from "./page";

// --- fixtures --------------------------------------------------------------

const NOW = new Date();
const YEAR = NOW.getFullYear();
const MONTH = NOW.getMonth(); // 0-indexed

// Local ISO at a given day/hour this month, e.g. iso(15, 8) → the 15th at
// 08:00 local. Date(...) treats these as local, toISOString serializes UTC.
function iso(day: number, hour: number, minute = 0): string {
  return new Date(YEAR, MONTH, day, hour, minute, 0, 0).toISOString();
}

const TODAY_DAY = NOW.getDate();
const TODAY = new Date(YEAR, MONTH, TODAY_DAY);

// The page seeds `selected` to today, and its cursor-change effect now skips
// its first run — so the digest's default after mount is TODAY (re-anchoring
// to the 1st only happens on subsequent Previous/Next month changes).

// A day guaranteed to differ from today, still inside the current month and
// thus always present as an in-month cell in the visible grid (days 1–28
// always render). Used by the "select a different day" and pill tests so they
// don't degenerate when today happens to be the 15th.
const DISTINCT_DAY = TODAY_DAY === 15 ? 16 : 15;
const DISTINCT_DATE = new Date(YEAR, MONTH, DISTINCT_DAY);

function makeWorkout(id: string, name: string, day: number): Workout {
  return {
    id,
    user_id: "u1",
    name,
    performed_at: iso(day, 8),
    ended_at: iso(day, 9), // ~1h later
    exercises: [
      {
        exercise_id: "back-squat",
        order: 0,
        sets: [{ reps: 5, weight: 100, unit: "kg" }],
      },
    ],
    created_at: iso(day, 8),
    updated_at: iso(day, 8),
    personal_records_set: [],
  };
}

function makeRun(id: string, name: string, day: number): RunningSession {
  return {
    id,
    activity_type: "running",
    ingest_source: "manual_tcx",
    source_activity_id: `src-${id}`,
    name,
    start_time: iso(day, 7), // 07:00, before the 08:00 workout
    distance_meters: 5000,
    duration_seconds: 1500,
    avg_pace_sec_per_km: 300,
    best_pace_sec_per_km: 280,
    avg_heart_rate_bpm: 150,
    max_heart_rate_bpm: 170,
    total_calories: 350,
    elevation_gain_meters: 20,
    created_at: iso(day, 7),
  };
}

// Today gets a workout + run (07:00 run before 08:00 lift) so the
// default-selected (today) digest has activities to assert and the two-a-day
// ordering path is exercised. A DISTINCT_DAY (≠ today, in-month) gets its own
// workout for the select-a-day and pill auto-expand tests. The 1st also gets a
// run so the month's running tiles always have data even when today isn't the
// 1st (and so the re-anchor-to-1st test lands on a populated day).
const TODAY_WORKOUT = makeWorkout("w-today", "Today Lift", TODAY_DAY);
const TODAY_RUN = makeRun("r-today", "Today Run", TODAY_DAY);
const DISTINCT_WORKOUT = makeWorkout("w-distinct", "Midmonth Lift", DISTINCT_DAY);
const FIRST_RUN = makeRun("r-1", "First Run", 1);

// Build the fixture lists so each seeded day appears exactly once. When today
// coincides with the 1st, the FIRST_RUN would duplicate the today-run's day —
// but the two are distinct activities (different ids), so both legitimately
// land on that day. They never share an id, so no double-seed occurs. The
// DISTINCT_DAY is computed to never equal today, so its workout is always its
// own day.
const WORKOUTS: Workout[] = [TODAY_WORKOUT, DISTINCT_WORKOUT];
const RUNS: RunningSession[] = [TODAY_RUN, FIRST_RUN];

// Zero-padded YYYY-MM-DD in the cursor month — the steps API's date format.
function isoDay(day: number): string {
  return `${YEAR}-${String(MONTH + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Today and the DISTINCT day each get a step total so the digest (today)
// and the weekly rollup (both) have step data to assert.
const STEPS: StepsEntry[] = [
  {
    id: "s-today",
    date: isoDay(TODAY_DAY),
    steps: 8000,
    created_at: iso(TODAY_DAY, 23),
    updated_at: iso(TODAY_DAY, 23),
  },
  {
    id: "s-distinct",
    date: isoDay(DISTINCT_DAY),
    steps: 12345,
    created_at: iso(DISTINCT_DAY, 23),
    updated_at: iso(DISTINCT_DAY, 23),
  },
];

// Long-form date string the digest/aria-label use, e.g. "Monday, June 15, 2026".
function longDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// --- environment shims -----------------------------------------------------

beforeAll(() => {
  // jsdom doesn't implement scrollIntoView; the page calls it on digest refs.
  Element.prototype.scrollIntoView = vi.fn();
});

beforeEach(() => {
  pushMock.mockClear();
  // Restore the default (loaded) mock implementations after any per-test
  // mockResolvedValueOnce overrides.
  vi.mocked(listWorkouts).mockResolvedValue({
    items: WORKOUTS,
    total: WORKOUTS.length,
    limit: 100,
    offset: 0,
    has_more: false,
  });
  vi.mocked(listRunningSessions).mockResolvedValue({ activities: RUNS, next_before: null });
  // Run rAF synchronously so the deferred scrollIntoView fires in-test.
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderPage() {
  return render(
    <DistanceUnitProvider>
      <CalendarPage />
    </DistanceUnitProvider>,
  );
}

// The digest is the <section> whose <h2> is the selected day's long date.
async function findDigest(d: Date): Promise<HTMLElement> {
  const heading = await screen.findByRole("heading", { level: 2, name: longDate(d) });
  // section is the heading's section ancestor.
  const section = heading.closest("section");
  if (!section) throw new Error("digest section not found");
  return section as HTMLElement;
}

describe("CalendarPage", () => {
  it("defaults to today and shows today's activities", async () => {
    // The page seeds `selected` to today and the cursor-change effect skips
    // its first run, so after data loads the digest reads today's date.
    renderPage();
    const digest = await findDigest(TODAY);
    // Today's run (07:00) and lift (08:00) banners both appear, ordered
    // run-before-lift (start-time sorted).
    expect(within(digest).getByText("Today Lift")).toBeInTheDocument();
    expect(within(digest).getByText("Today Run")).toBeInTheDocument();
    const titles = within(digest)
      .getAllByText(/Today (Run|Lift)/)
      .map((el) => el.textContent);
    expect(titles).toEqual(["Today Run", "Today Lift"]);
  });

  it("updates the digest when a different day cell is selected", async () => {
    renderPage();
    // Wait for the default (today) digest to render.
    await findDigest(TODAY);

    // The day cell exposes the long date via aria-label.
    const cell = screen.getByLabelText(new RegExp(`^${longDate(DISTINCT_DATE)}`));
    fireEvent.click(cell);

    const digest = await findDigest(DISTINCT_DATE);
    expect(within(digest).getByText("Midmonth Lift")).toBeInTheDocument();
  });

  it("re-anchors selection to the 1st of the new month on cursor change", async () => {
    renderPage();
    // Default selection is today (not the 1st) before any month change.
    await findDigest(TODAY);

    fireEvent.click(screen.getByLabelText("Previous month"));

    const prevMonthFirst = new Date(YEAR, MONTH - 1, 1);
    // Digest header now shows the 1st of the previous month.
    await screen.findByRole("heading", { level: 2, name: longDate(prevMonthFirst) });
  });

  it("auto-expands the digest banner when a grid pill is clicked", async () => {
    renderPage();
    await findDigest(TODAY);

    // Use the DISTINCT_DAY's workout pill so it's distinct from the default
    // (today) digest.
    const cell = screen.getByLabelText(new RegExp(`^${longDate(DISTINCT_DATE)}`));
    // The pill is a button inside the cell whose accessible name is the name.
    // Day cells render synchronously from the date grid, but their pills paint
    // only after the async listWorkouts data settles — so find (await) the
    // pill rather than get it, or this races on slower (CI) machines and sees
    // an empty cell.
    const pill = await within(cell).findByRole("button", { name: "Midmonth Lift" });
    fireEvent.click(pill);

    const digest = await findDigest(DISTINCT_DATE);
    // The chevron's accessible name flips to "Collapse details" when open,
    // and the dropdown content ("Total volume") becomes visible. The chevron
    // only exists in the digest banner, not in the grid pill.
    await waitFor(() => {
      expect(within(digest).getByLabelText("Collapse details")).toHaveAttribute(
        "aria-expanded",
        "true",
      );
    });
    expect(within(digest).getByText(/Total volume/i)).toBeInTheDocument();
  });

  it("shows weekly tiles whose activity counts sum to the visible fixtures", async () => {
    renderPage();
    await findDigest(TODAY);

    const tiles = await screen.findAllByTestId("weekly-tile");
    expect(tiles.length).toBe(6); // six week rows
    // Sum the per-week activity counts; every fixture lands in the cursor
    // month, so the total equals all seeded workouts + runs.
    const total = tiles.reduce((sum, tile) => {
      const m = tile.textContent?.match(/(\d+)\s+activit(?:y|ies)/);
      return sum + (m ? Number(m[1]) : 0);
    }, 0);
    expect(total).toBe(WORKOUTS.length + RUNS.length);
    // And at least one tile carries a concrete count (sanity that the rollup
    // rendered, not just six empty weeks).
    expect(tiles.some((t) => /[1-9]\d*\s+activit/.test(t.textContent ?? ""))).toBe(true);
  });

  it("rolls weekly steps into the weekly tiles", async () => {
    renderPage();
    await findDigest(TODAY);

    const tiles = await screen.findAllByTestId("weekly-tile");
    // The seeded step totals (8,000 + 12,345) land in the cursor month, so
    // at least one week tile carries a Steps row.
    expect(tiles.some((t) => /Steps/.test(t.textContent ?? ""))).toBe(true);
  });

  it("shows the selected day's step count in the digest", async () => {
    renderPage();
    const digest = await findDigest(TODAY);
    // Today's fixture logs 8,000 steps.
    await waitFor(() => {
      expect(within(digest).getByTestId("steps-banner")).toHaveTextContent("8,000 steps");
    });
  });

  it("shows Avg Pace and Longest Run tiles when the month has runs", async () => {
    renderPage();
    await findDigest(TODAY);

    const avgPace = await screen.findByText("Avg Pace");
    const longestRun = screen.getByText("Longest Run");
    // Neither tile sits inside a `hidden` wrapper when runs exist.
    expect(avgPace.closest(".hidden")).toBeNull();
    expect(longestRun.closest(".hidden")).toBeNull();
  });

  it("hides Avg Pace and Longest Run tiles when the month has no runs", async () => {
    vi.mocked(listRunningSessions).mockResolvedValue({ activities: [], next_before: null });
    renderPage();
    // Digest still renders (today has a workout) — wait for data to settle.
    await findDigest(TODAY);

    // The tiles are still in the DOM but inside a `.hidden` wrapper.
    const avgPace = await screen.findByText("Avg Pace");
    const longestRun = screen.getByText("Longest Run");
    expect(avgPace.closest(".hidden")).not.toBeNull();
    expect(longestRun.closest(".hidden")).not.toBeNull();
  });
});
