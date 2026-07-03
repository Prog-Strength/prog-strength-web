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

// The calendar reads the active-workout session to start a workout from a
// planned lift; stub it so the page renders without the full provider tree.
const startMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/active-workout-session", () => ({
  useActiveWorkoutSession: () => ({ start: startMock }),
}));

// The redesigned header greets the user by display_name via useProfile.
vi.mock("@/lib/profile-context", () => ({
  useProfile: () => ({ profile: { display_name: "Sam" } }),
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
  listPlannedWorkouts: vi.fn(async () => PLANNED),
  getCalendarConnection: vi.fn(async () => ({ status: "connected" })),
  resyncPlannedWorkout: vi.fn(async () => PLANNED[0]),
}));

import { listWorkouts, listRunningSessions, listPlannedWorkouts } from "@/lib/api";
import type { PlannedWorkout } from "@/lib/api";
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
    raw_distance_meters: 5000,
    environment: "outdoor",
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
// workout for the select-a-day and pill navigation tests. The 1st also gets a
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

// A planned workout on the DISTINCT day so it renders alongside that day's
// logged workout — the "distinct from a logged pill" assertion compares the
// two on the same cell.
function makePlanned(id: string, name: string, day: number): PlannedWorkout {
  return {
    id,
    name,
    activity_kind: "lift",
    scheduled_start: iso(day, 17), // 17:00, after the day's logged events
    scheduled_end: iso(day, 18),
    timezone: "America/Denver",
    status: "planned",
    notes: null,
    completed_session_id: null,
    completed_session_kind: null,
    calendar_detail: null,
    google_event_id: null,
    google_sync_status: null,
    last_sync_error: null,
    run_type: null,
    run_details: null,
    exercises: [],
    created_at: iso(day, 12),
    updated_at: iso(day, 12),
  };
}

const PLANNED_WORKOUT = makePlanned("p-distinct", "Planned Squats", DISTINCT_DAY);
const PLANNED: PlannedWorkout[] = [PLANNED_WORKOUT];

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
  vi.mocked(listPlannedWorkouts).mockResolvedValue(PLANNED);
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

  it("navigates to the session detail when a logged grid pill is clicked", async () => {
    renderPage();
    await findDigest(TODAY);

    const cell = screen.getByLabelText(new RegExp(`^${longDate(DISTINCT_DATE)}`));
    const pill = await within(cell).findByRole("button", { name: "Midmonth Lift" });
    fireEvent.click(pill);

    expect(pushMock).toHaveBeenCalledWith("/workouts/w-distinct");
  });

  it("opens the read-only planned modal when a planned grid pill is clicked", async () => {
    renderPage();
    await findDigest(TODAY);

    const cell = screen.getByLabelText(new RegExp(`^${longDate(DISTINCT_DATE)}`));
    const pill = await within(cell).findByTestId("planned-pill");
    fireEvent.click(pill);

    // The planned-workout modal opens in read-only view for that plan.
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Edit planned workout")).toBeInTheDocument();
  });

  it("shows one Week rollup column per week summarizing trained days", async () => {
    renderPage();
    await findDigest(TODAY);

    // The grid is now month-bounded: only the whole weeks intersecting the
    // current month render, so the row count varies (4–6) by month. Replicate
    // the page's Monday-first span here rather than hardcoding 6.
    const mondayOffset = (new Date(YEAR, MONTH, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(YEAR, MONTH + 1, 0).getDate();
    const expectedWeeks = Math.ceil((mondayOffset + daysInMonth) / 7);
    expect(expectedWeeks).toBeGreaterThanOrEqual(4);
    expect(expectedWeeks).toBeLessThanOrEqual(6);

    const columns = await screen.findAllByTestId("week-column");
    expect(columns.length).toBe(expectedWeeks);
    // No phantom next-month rows: the last week row holds at least one day of
    // the cursor month (a fixed 42-cell grid would emit an all-next-month row
    // for short months). The grid's day cells expose their long date via
    // aria-label; assert the cursor month appears among the last seven cells.
    const cells = screen.getAllByLabelText(new RegExp(`^[A-Za-z]+, [A-Za-z]+ \\d+, \\d{4}`));
    const lastWeekCells = cells.slice(-7);
    const cursorMonthName = new Date(YEAR, MONTH, 1).toLocaleDateString("en-US", {
      month: "long",
    });
    expect(
      lastWeekCells.some((c) => (c.getAttribute("aria-label") ?? "").includes(cursorMonthName)),
    ).toBe(true);
    // Each Week column carries a trained-days indicator (N/M of in-month days).
    expect(columns.some((c) => /\d+\/\d+/.test(c.textContent ?? ""))).toBe(true);
    // Exactly the week containing today is emphasized as the current week.
    expect(columns.filter((c) => c.getAttribute("data-current") === "true")).toHaveLength(1);
  });

  it("rolls weekly steps into the Week rollup column", async () => {
    renderPage();
    await findDigest(TODAY);

    const columns = await screen.findAllByTestId("week-column");
    // The seeded step totals land in the cursor month, so at least one Week
    // column carries a steps metric label (👟 with a separated total).
    expect(columns.some((c) => /👟/.test(c.textContent ?? ""))).toBe(true);
  });

  it("greets the user by name with a month-consistency line", async () => {
    renderPage();
    await findDigest(TODAY);
    expect(await screen.findByText(/Sam/)).toBeInTheDocument();
    expect(
      screen.getByText(/trained \d+ days? this month|fresh month to build on/),
    ).toBeInTheDocument();
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

  it("fetches planned workouts for the visible window", async () => {
    renderPage();
    await findDigest(TODAY);
    await waitFor(() => expect(vi.mocked(listPlannedWorkouts)).toHaveBeenCalled());
    // Called with the same since/until window as the timed-activity fetches.
    const call = vi.mocked(listPlannedWorkouts).mock.calls[0];
    expect(call[1]).toEqual(expect.objectContaining({ since: expect.any(String) }));
    expect(call[1]).toEqual(expect.objectContaining({ until: expect.any(String) }));
  });

  it("renders a planned pill distinct from a logged workout pill", async () => {
    renderPage();
    await findDigest(TODAY);

    const cell = screen.getByLabelText(new RegExp(`^${longDate(DISTINCT_DATE)}`));
    // The logged workout renders as a solid pill (its accessible name is the
    // workout name); the planned workout renders as a dashed pill carrying
    // the planned-pill test id — visually and structurally distinct.
    const loggedPill = await within(cell).findByRole("button", { name: "Midmonth Lift" });
    const plannedPill = await within(cell).findByTestId("planned-pill");
    expect(plannedPill).toBeInTheDocument();
    expect(plannedPill).toHaveTextContent("Planned Squats");
    // The planned pill uses a dashed outline; the logged pill does not.
    expect(plannedPill.className).toMatch(/border-dashed/);
    expect(loggedPill.className).not.toMatch(/border-dashed/);
    // And they're two different elements.
    expect(plannedPill).not.toBe(loggedPill);
  });

  it("collapses a completed planned session and its same-day logged workout into one pill", async () => {
    // A plan on the DISTINCT day, completed and linked to that day's logged
    // workout (w-distinct). The calendar should show a single collapsed pill
    // — not the dashed planned pill stacked on the solid logged pill.
    const linkedPlan = makePlanned("p-linked", "W7 D1 - Easy Run", DISTINCT_DAY);
    linkedPlan.status = "completed";
    linkedPlan.completed_session_id = "w-distinct";
    linkedPlan.completed_session_kind = "workout";
    vi.mocked(listPlannedWorkouts).mockResolvedValue([linkedPlan]);

    renderPage();
    await findDigest(TODAY);

    const cell = screen.getByLabelText(new RegExp(`^${longDate(DISTINCT_DATE)}`));
    // One collapsed pill is present; the standalone planned + logged pills are
    // gone (no dashed planned pill, and the merged pill carries the check).
    const collapsed = await within(cell).findByTestId("completed-planned-pill");
    expect(collapsed).toBeInTheDocument();
    expect(within(cell).queryByTestId("planned-pill")).not.toBeInTheDocument();
    // The merged pill replaces the duplicate — only one pill bears the name.
    expect(within(cell).getAllByText(/W7 D1 - Easy Run|Midmonth Lift/)).toHaveLength(1);
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
