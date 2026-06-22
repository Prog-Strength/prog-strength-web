/**
 * DESIGN EXPLORATION — activities-overview · shared fixtures (throwaway).
 *
 * Static, realistic fixtures for the Activities → Overview DX. Every
 * variant component reads from here so the five compositions render the
 * SAME training quarter and stay comparable. This is data only — no visual
 * abstraction is shared (that is the point of a DX: variants diverge on
 * composition, not on a common widget set).
 *
 * The fixture is the ticket's "representative `Last 90 days` block": a real
 * training quarter with a rest-week trough, a lifting+running mix, a few
 * pace-less manual runs, and a steps series with gap days. Consistency
 * readouts (days active, streaks) are DERIVED from the heatmap pattern so
 * the grid and the "41 of 90" readout can never disagree.
 *
 * NOT wired to live services — see the DX ticket: static fixtures that look
 * real are preferred over real data wiring for a disposable mockup.
 */

// Fixed anchor — "today" for the fixture. Hard-coded so the 90-day grid is
// deterministic regardless of when the preview is built/viewed.
const ANCHOR = new Date("2026-06-21T12:00:00");

const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Day-by-day activity pattern (oldest → newest, 90 days).
//   '.' rest · l lift · L heavy lift · r run · R long run · x both
// Hand-authored to contain a visible rest week (~May 25), a 9-day longest
// streak, and a current 3-day streak — the ticket's stated consistency.
// ---------------------------------------------------------------------------
const PATTERN = [
  "l...r..", // wk 1
  "l..r...", // wk 2
  "..r.lx.", // wk 3
  "l..L..r", // wk 4
  ".x...R.", // wk 5
  "l..r...", // wk 6
  "...l.r.", // wk 7
  "lLrlxrr", // wk 8  — streak builds
  "Rl.....", // wk 9  — …completes a 9-day run
  ".......", // wk 10 — REST WEEK (trough near May 25)
  "lLxRlLR", // wk 11 — peak week (Jun 1–7)
  "l.rx.rr", // wk 12
  "l..xrr", //  wk 13 — current 3-day streak into "today"
].join("");

export type Discipline = "lift" | "run" | "both";

export type HeatCell = {
  date: Date;
  /** 0 = rest, else 1–4 intensity (drives the tint ramp). */
  level: number;
  disc: Discipline | null;
};

function cellFor(ch: string, date: Date): HeatCell {
  switch (ch) {
    case "l":
      return { date, level: 2, disc: "lift" };
    case "L":
      return { date, level: 3, disc: "lift" };
    case "r":
      return { date, level: 2, disc: "run" };
    case "R":
      return { date, level: 3, disc: "run" };
    case "x":
      return { date, level: 4, disc: "both" };
    default:
      return { date, level: 0, disc: null };
  }
}

export const heatmap: HeatCell[] = Array.from(PATTERN).map((ch, i) => {
  const date = new Date(ANCHOR.getTime() - (PATTERN.length - 1 - i) * DAY_MS);
  return cellFor(ch, date);
});

function deriveConsistency(cells: HeatCell[]) {
  const totalDays = cells.length;
  let daysActive = 0;
  let longest = 0;
  let run = 0;
  for (const c of cells) {
    if (c.level > 0) {
      daysActive += 1;
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 0;
    }
  }
  // Current streak = trailing run of active days up to "today".
  let current = 0;
  for (let i = cells.length - 1; i >= 0; i--) {
    if (cells[i].level > 0) current += 1;
    else break;
  }
  return { daysActive, totalDays, currentStreak: current, longestStreak: longest };
}

export const consistency = deriveConsistency(heatmap);

// ---------------------------------------------------------------------------
// Weekly series — 13 ISO weeks aligned to the pattern above. Minutes per
// modality, weekly mileage, and weekly avg pace. Week 10 is the rest week
// (zeros / null pace).
// ---------------------------------------------------------------------------
export type WeekPoint = {
  /** Monday of the week, for axis labelling. */
  weekStart: Date;
  label: string; // "May 25"
  liftMin: number;
  runMin: number;
  mileageMi: number;
  /** Avg pace sec/mi for the week; null on the rest week (no runs). */
  paceSecPerMi: number | null;
};

const LIFT_MIN = [130, 150, 120, 140, 135, 150, 90, 165, 140, 0, 210, 170, 150];
const RUN_MIN = [55, 60, 70, 65, 75, 60, 45, 150, 95, 0, 160, 120, 90];
const MILEAGE = [6, 7, 8, 7.5, 9, 7, 5, 16, 11, 0, 18, 13, 10];
const PACE = [580, 575, 572, 568, 560, 565, 558, 552, 556, null, 548, 545, 554];

export const weeks: WeekPoint[] = LIFT_MIN.map((liftMin, i) => {
  // Week i Monday: walk back from the most recent Monday on/before ANCHOR.
  const weeksBack = LIFT_MIN.length - 1 - i;
  const mondayAnchor = new Date(ANCHOR);
  const dow = (mondayAnchor.getDay() + 6) % 7; // 0 = Monday
  mondayAnchor.setDate(mondayAnchor.getDate() - dow - weeksBack * 7);
  return {
    weekStart: mondayAnchor,
    label: mondayAnchor.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    liftMin,
    runMin: RUN_MIN[i],
    mileageMi: MILEAGE[i],
    paceSecPerMi: PACE[i],
  };
});

// ---------------------------------------------------------------------------
// Steps — a 90-day daily series trending flat-to-up around 9k, with two gap
// days where nothing was logged (null, rendered as a break, never zero).
// ---------------------------------------------------------------------------
export type StepPoint = { date: Date; steps: number | null };

export const steps: StepPoint[] = Array.from({ length: 90 }, (_, i) => {
  const date = new Date(ANCHOR.getTime() - (89 - i) * DAY_MS);
  if (i === 31 || i === 67) return { date, steps: null }; // gap days
  const trend = 8200 + Math.round(i * 13);
  const wave = Math.round(Math.sin(i / 4) * 850);
  return { date, steps: trend + wave };
});

const loggedSteps = steps.filter((s): s is { date: Date; steps: number } => s.steps !== null);
export const avgDailySteps = Math.round(
  loggedSteps.reduce((a, s) => a + s.steps, 0) / loggedSteps.length,
);

// ---------------------------------------------------------------------------
// Headline + running + split rollups — the ticket's representative block.
// ---------------------------------------------------------------------------
export const headline = {
  totalMinutes: 46 * 60 + 7, // 46h 7m
  sessions: 47,
  workouts: 21,
  runs: 26,
  avgSessionMinutes: 59,
  windowLabel: "Last 90 days",
};

export const running = {
  mileageMi: 121.5,
  avgPaceSecPerMi: 9 * 60 + 14, // 9:14 /mi
  bestPaceSecPerMi: 7 * 60 + 48, // 7:48 /mi
  avgHrBpm: 151,
  maxHrBpm: 178,
  elevationFt: 4120,
  manualRuns: 3, // pace/HR null — drives the "weighted only over runs with data" note
};

// Discipline time-split (share of active *time*). ~27h lifting · 19h running.
export const split = {
  liftMin: 27 * 60,
  runMin: 19 * 60,
};

// ---------------------------------------------------------------------------
// Formatters (pure; local to the DX route so variants stay self-contained).
// ---------------------------------------------------------------------------

/** "46h 7m" / "59m" / "2h" from a minute count. */
export function fmtHm(minutes: number): string {
  const total = Math.round(minutes);
  if (total <= 0) return "0m";
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** "9:14" from a seconds-per-mile value, or "—" when null. */
export function fmtPace(secPerMi: number | null): string {
  if (secPerMi == null) return "—";
  const m = Math.floor(secPerMi / 60);
  const s = Math.round(secPerMi % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Discipline → design-system token group (bg / fg / dot). */
export const DISC_TOKENS: Record<
  Exclude<Discipline, "both">,
  { bg: string; fg: string; dot: string }
> = {
  lift: {
    bg: "var(--discipline-lift-bg)",
    fg: "var(--discipline-lift-fg)",
    dot: "var(--discipline-lift-dot)",
  },
  run: {
    bg: "var(--discipline-run-bg)",
    fg: "var(--discipline-run-fg)",
    dot: "var(--discipline-run-dot)",
  },
};
