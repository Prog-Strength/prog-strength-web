/**
 * Static, realistic fixtures for the activities-page Design Exploration.
 *
 * THROWAWAY. This module exists only to feed the /design-explore/activities-page
 * comparison route (see ../../../dx/activities-page in prog-strength-docs). It is
 * NOT wired to any live service — the DX brief explicitly prefers static fixtures
 * that look real over real data plumbing. Numbers mirror the "Last 30 days"
 * representative fixture in the ticket: a real training month with a rest-week
 * trough, PRs, and an over- and under-goal step day.
 *
 * Shared by all five variant components. Variants diverge on presentation only;
 * they all read this same shape so the comparison is honest.
 */

export type Period = "7d" | "30d" | "90d" | "all";

export const PERIODS: { id: Period; label: string; short: string }[] = [
  { id: "7d", label: "Last 7 days", short: "7D" },
  { id: "30d", label: "Last 30 days", short: "30D" },
  { id: "90d", label: "Last 90 days", short: "90D" },
  { id: "all", label: "All time", short: "ALL" },
];

// --- Overview ------------------------------------------------------------

export type StatTile = {
  key: string;
  label: string;
  value: string;
  /** secondary line, e.g. unit or sub-context */
  sub?: string;
  /** which domain this belongs to, for variants that color by domain */
  domain?: "lift" | "run" | "steps" | "cross";
};

/** Top stat row + second stat row, in ticket order. */
export const OVERVIEW_STATS_PRIMARY: StatTile[] = [
  { key: "time", label: "Total time", value: "14h 1m", domain: "cross" },
  { key: "sessions", label: "Total sessions", value: "13", domain: "cross" },
  { key: "workouts", label: "Workouts", value: "8", domain: "lift" },
  { key: "runs", label: "Runs", value: "5", domain: "run" },
];

export const OVERVIEW_STATS_SECONDARY: StatTile[] = [
  { key: "volume", label: "Total volume", value: "150,875", sub: "lb", domain: "lift" },
  { key: "mileage", label: "Total mileage", value: "22.3", sub: "mi", domain: "run" },
  { key: "prs", label: "PRs", value: "7", domain: "lift" },
  { key: "avg", label: "Avg session", value: "1h 5m", domain: "cross" },
];

export const STEPS_SUMMARY = {
  avgDaily: 8250,
  goal: 10000,
  pctOfGoal: 83,
};

/**
 * Weekly dual-series data for the signature Overview chart — Lifting and
 * Running hours per week. 13 weeks (covers 90d); slice by period with
 * `weeksForPeriod`. The week of May 25 is the deliberate rest trough (both ~0h);
 * the week of Jun 1–7 is the peak (Lifting 4h 48m, Running 37m).
 */
export type WeekPoint = {
  weekStartMs: number;
  /** "Jun 1" short label for axis ticks */
  tick: string;
  /** "Jun 1 – 7" full range for tooltips */
  range: string;
  liftMin: number;
  runMin: number;
};

// Anchored to fixed timestamps (no Date.now — keeps fixtures deterministic).
const MON = 7 * 24 * 60 * 60 * 1000;
const WEEK0 = Date.UTC(2026, 2, 23); // Mar 23, 2026 — oldest week shown for "all"

function mkWeek(
  idx: number,
  tick: string,
  range: string,
  liftMin: number,
  runMin: number,
): WeekPoint {
  return { weekStartMs: WEEK0 + idx * MON, tick, range, liftMin, runMin };
}

// 13 most-recent weeks. Index 12 is the current/most-recent week (Jun 15–21).
export const WEEKLY: WeekPoint[] = [
  mkWeek(0, "Mar 23", "Mar 23 – 29", 162, 28),
  mkWeek(1, "Mar 30", "Mar 30 – Apr 5", 188, 52),
  mkWeek(2, "Apr 6", "Apr 6 – 12", 205, 41),
  mkWeek(3, "Apr 13", "Apr 13 – 19", 170, 64),
  mkWeek(4, "Apr 20", "Apr 20 – 26", 142, 33),
  mkWeek(5, "Apr 27", "Apr 27 – May 3", 224, 49),
  mkWeek(6, "May 4", "May 4 – 10", 198, 71),
  mkWeek(7, "May 11", "May 11 – 17", 176, 22),
  mkWeek(8, "May 18", "May 18 – 24", 210, 58),
  mkWeek(9, "May 25", "May 25 – 31", 0, 0), // rest week — intentional, not missing
  mkWeek(10, "Jun 1", "Jun 1 – 7", 288, 37), // peak: 4h 48m lift, 37m run
  mkWeek(11, "Jun 8", "Jun 8 – 14", 152, 46),
  mkWeek(12, "Jun 15", "Jun 15 – 21", 90, 43),
];

export function weeksForPeriod(period: Period): WeekPoint[] {
  switch (period) {
    case "7d":
      return WEEKLY.slice(-1);
    case "30d":
      return WEEKLY.slice(-5);
    case "90d":
      return WEEKLY.slice(-13);
    case "all":
      return WEEKLY;
  }
}

// --- Workouts (lifting) --------------------------------------------------

export const WORKOUTS_SUMMARY = {
  totalTime: "10h 32m",
  sessions: 8,
  prs: 7,
};

export type SessionCard = {
  id: string;
  name: string;
  isPR: boolean;
  /** "Yesterday, 4:45 PM" */
  when: string;
  duration: string;
  exercises: number;
  /** total volume, formatted with commas, no unit */
  volume: string;
  note?: string;
};

export type WeekGroup = {
  id: string;
  label: string; // "This week"
  range: string; // "Jun 15 – 21"
  totalTime: string;
  activities: number;
  sessions: SessionCard[];
};

export const WORKOUT_WEEKS: WeekGroup[] = [
  {
    id: "w-this",
    label: "This week",
    range: "Jun 15 – 21",
    totalTime: "1h 30m",
    activities: 1,
    sessions: [
      {
        id: "s1",
        name: "W5 D1 - Chest & Back",
        isPR: true,
        when: "Yesterday, 4:45 PM",
        duration: "1h 30m",
        exercises: 6,
        volume: "29,090",
        note: "Bench exercises felt great but my bent over row was struggling today. Not sure why though to be honest, maybe the long run yesterday.",
      },
    ],
  },
  {
    id: "w-last",
    label: "Last week",
    range: "Jun 8 – 14",
    totalTime: "2h 32m",
    activities: 2,
    sessions: [
      {
        id: "s2",
        name: "Recovery Week Lift 2 - Shoulders & Arms",
        isPR: true,
        when: "Saturday, 12:23 PM",
        duration: "1h 17m",
        exercises: 6,
        volume: "17,875",
        note: "Kept it light, focused on the mind-muscle connection. Shoulders fried by the end.",
      },
      {
        id: "s3",
        name: "Recovery Week Lift 1 - Legs",
        isPR: false,
        when: "Wednesday, 6:02 PM",
        duration: "1h 15m",
        exercises: 5,
        volume: "41,200",
      },
    ],
  },
  {
    id: "w-jun1",
    label: "Week of Jun 1",
    range: "Jun 1 – 7",
    totalTime: "4h 48m",
    activities: 3,
    sessions: [
      {
        id: "s4",
        name: "W4 D3 - Deadlift Focus",
        isPR: true,
        when: "Sat, Jun 6 · 9:14 AM",
        duration: "1h 42m",
        exercises: 5,
        volume: "52,310",
        note: "New deadlift PR at 405. Felt unstoppable.",
      },
      {
        id: "s5",
        name: "W4 D2 - Push",
        isPR: false,
        when: "Thu, Jun 4 · 5:30 PM",
        duration: "1h 28m",
        exercises: 7,
        volume: "31,140",
      },
      {
        id: "s6",
        name: "W4 D1 - Pull",
        isPR: true,
        when: "Tue, Jun 2 · 6:11 PM",
        duration: "1h 38m",
        exercises: 6,
        volume: "38,135",
      },
    ],
  },
  {
    id: "w-rest",
    label: "Week of May 25",
    range: "May 25 – 31",
    totalTime: "0m",
    activities: 0,
    sessions: [], // intentional rest week
  },
];

// --- Running -------------------------------------------------------------

export type RunningKPI = {
  key: string;
  label: string;
  value: string;
  sub?: string;
  /** signed delta in pct, null = no prior week (hide it) */
  deltaPct?: number | null;
};

export const RUNNING_KPIS: RunningKPI[] = [
  { key: "week", label: "This week", value: "4.2", sub: "mi", deltaPct: 18 },
  { key: "month", label: "This month", value: "11.7", sub: "mi · 3 runs" },
  { key: "pace", label: "Avg pace", value: "9:22", sub: "/mi · 30D" },
  { key: "all", label: "All time", value: "116.3", sub: "mi · 25 runs" },
];

export const RUNNING_SUMMARY = {
  totalDistance: "22.3",
  totalTime: "3h 29m",
  runs: 5,
};

export type RunCard = {
  id: string;
  name: string;
  when: string;
  distance: string; // "4.2 mi"
  time: string; // "42:51"
  pace: string; // "10:07 /mi"
  hr: string; // "153 bpm"
};

export type RunMonth = {
  id: string;
  label: string; // "June 2026"
  summary: string; // "11.7 mi · 1h 55m · 3 runs"
  weeks: { id: string; label: string; range: string; summary: string; runs: RunCard[] }[];
};

export const RUN_MONTHS: RunMonth[] = [
  {
    id: "jun2026",
    label: "June 2026",
    summary: "11.7 mi · 1h 55m · 3 runs",
    weeks: [
      {
        id: "rw-this",
        label: "This week",
        range: "Jun 15 – 21",
        summary: "4.2 mi · 43m · 1 run",
        runs: [
          {
            id: "r1",
            name: "W7 D1 - Easy Run",
            when: "Mon, Jun 15, 2026 · 1:39 PM",
            distance: "4.2 mi",
            time: "42:51",
            pace: "10:07 /mi",
            hr: "153 bpm",
          },
        ],
      },
      {
        id: "rw-last",
        label: "Last week",
        range: "Jun 8 – 14",
        summary: "7.5 mi · 1h 12m · 2 runs",
        runs: [
          {
            id: "r2",
            name: "Tempo Intervals",
            when: "Fri, Jun 12, 2026 · 6:48 AM",
            distance: "3.1 mi",
            time: "27:40",
            pace: "8:55 /mi",
            hr: "168 bpm",
          },
          {
            id: "r3",
            name: "W6 D2 - Long Run",
            when: "Sun, Jun 14, 2026 · 8:02 AM",
            distance: "4.4 mi",
            time: "44:30",
            pace: "10:06 /mi",
            hr: "149 bpm",
          },
        ],
      },
    ],
  },
];

// --- Steps ---------------------------------------------------------------

export const STEPS_KPIS: StatTile[] = [
  { key: "avg", label: "Avg daily steps", value: "8,250" },
  { key: "total", label: "Total steps", value: "33,000" },
  { key: "best", label: "Best day", value: "11,000", sub: "Jun 14" },
  { key: "goal", label: "Goal", value: "83%", sub: "of 10,000" },
];

export type StepDay = {
  date: string; // "Jun 14"
  dow: string; // "Sun"
  steps: number;
  /** relative to the 10,000 goal */
  state: "over" | "at" | "under";
};

export const STEPS_GOAL = 10000;

export const STEP_DAYS: StepDay[] = [
  { date: "Jun 11", dow: "Thu", steps: 9100, state: "under" },
  { date: "Jun 12", dow: "Fri", steps: 10400, state: "over" },
  { date: "Jun 13", dow: "Sat", steps: 7800, state: "under" },
  { date: "Jun 14", dow: "Sun", steps: 11000, state: "over" },
  { date: "Jun 15", dow: "Mon", steps: 10000, state: "at" },
  { date: "Jun 16", dow: "Tue", steps: 5500, state: "under" },
  { date: "Jun 17", dow: "Wed", steps: 6500, state: "under" },
];

export type StepLogRow = { id: string; date: string; steps: number };

export const STEP_LOG: StepLogRow[] = [
  { id: "l1", date: "Jun 17, 2026", steps: 6500 },
  { id: "l2", date: "Jun 16, 2026", steps: 5500 },
  { id: "l3", date: "Jun 15, 2026", steps: 10000 },
  { id: "l4", date: "Jun 14, 2026", steps: 11000 },
  { id: "l5", date: "Jun 13, 2026", steps: 7800 },
  { id: "l6", date: "Jun 12, 2026", steps: 10400 },
  { id: "l7", date: "Jun 11, 2026", steps: 9100 },
];

// --- Tab metadata --------------------------------------------------------

export type TabId = "overview" | "workouts" | "running" | "steps";

export const TABS: { id: TabId; label: string; action?: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "workouts", label: "Workouts", action: "Start live workout" },
  { id: "running", label: "Running", action: "Upload TCX" },
  { id: "steps", label: "Steps", action: "Log steps" },
];

/** Format a signed delta for display, e.g. +18% / −6%. */
export function fmtDelta(pct: number): string {
  const sign = pct >= 0 ? "+" : "−";
  return `${sign}${Math.abs(pct)}%`;
}
