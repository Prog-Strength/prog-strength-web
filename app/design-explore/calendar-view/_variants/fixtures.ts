/**
 * Static fixture for the calendar-view Design Exploration.
 *
 * Mirrors the "representative fixture" in dx/calendar-view.md: June 2026, a
 * month that is completed through the first half and planned through the
 * second, with one dense day (Jun 16, four planned sessions), a recovery
 * week (Jun 8), and two empty trailing weeks (Jun 22, Jun 29).
 *
 * This is intentionally NOT wired to lib/api types — it is a throwaway
 * shape that every variant reads, so the variants stay self-contained and
 * the mockup never touches real data services. June 1, 2026 is a Monday, so
 * the Mon→Sun grid starts clean with no leading days.
 */

export type Discipline = "lift" | "run" | "mobility" | "core";

export type CalEvent = {
  id: string;
  /** "done" = logged; "planned" = forward-looking intent. */
  state: "done" | "planned";
  discipline: Discipline;
  /** A done session that closed out a planned one (the merged tri-state). */
  fromPlan?: boolean;
  recurring?: boolean;
  name: string;
  /** Display time, e.g. "7:30 AM". */
  time: string;
  /** Lifts. */
  sets?: number;
  durationMin?: number;
  /** Runs. */
  distanceMi?: number;
  pace?: string; // "9:49"
  runKind?: string; // "Base", "Interval", "Easy"
};

export type DayCell = {
  /** Day-of-month number shown in the cell. */
  date: number;
  /** Adjacent-month (leading/trailing) days render de-emphasized. */
  inMonth: boolean;
  isToday: boolean;
  events: CalEvent[];
};

export type WeekSummary = {
  sessions: number;
  liftLabel?: string; // "4h 48m"
  runLabel?: string; // "3.9 mi"
  stepsLabel?: string; // "11,000"
};

export type Week = {
  /** Label for the week, e.g. "Jun 1 – 7". */
  label: string;
  days: DayCell[];
  summary: WeekSummary;
};

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const MONTH_LABEL = "June 2026";

/** The six hero stats for the visible month. */
export const MONTH_STATS: { label: string; value: string; unit?: string }[] = [
  { label: "Lift Time", value: "7h 20m" },
  { label: "Run Time", value: "1h 55m" },
  { label: "Run Distance", value: "11.7", unit: "mi" },
  { label: "Avg Pace", value: "9:49", unit: "/mi" },
  { label: "Longest Run", value: "4.2", unit: "mi" },
  { label: "Activities", value: "9" },
];

/**
 * 30-day training volume, one entry per day-of-month (index 0 = Jun 1).
 * Drives the Strava-style sparkline. Units are arbitrary "load" — lifts and
 * runs blended — and the back half is zero (planned, not yet done).
 */
export const VOLUME_30D: number[] = [
  62,
  41,
  70,
  0,
  0,
  58,
  66, // Jun 1–7
  0,
  0,
  34,
  0,
  0,
  38,
  40, // Jun 8–14 (recovery week — lower)
  44,
  0,
  0,
  0,
  0,
  0,
  0, // Jun 15–21 (only Mon done)
  0,
  0,
  0,
  0,
  0,
  0,
  0, // Jun 22–28
  0,
  0, // Jun 29–30
];

function lift(
  id: string,
  name: string,
  time: string,
  sets: number,
  durationMin: number,
  extra: Partial<CalEvent> = {},
): CalEvent {
  return { id, state: "done", discipline: "lift", name, time, sets, durationMin, ...extra };
}

function run(
  id: string,
  name: string,
  time: string,
  distanceMi: number,
  durationMin: number,
  pace: string,
  runKind: string,
  extra: Partial<CalEvent> = {},
): CalEvent {
  return {
    id,
    state: "done",
    discipline: "run",
    name,
    time,
    distanceMi,
    durationMin,
    pace,
    runKind,
    ...extra,
  };
}

function planned(
  id: string,
  discipline: Discipline,
  name: string,
  time: string,
  extra: Partial<CalEvent> = {},
): CalEvent {
  return { id, state: "planned", discipline, name, time, ...extra };
}

function empty(date: number, inMonth = true, isToday = false): DayCell {
  return { date, inMonth, isToday, events: [] };
}

export const WEEKS: Week[] = [
  // Week of Jun 1 — completed lifts Mon/Wed/Sat/Sun, easy run Tue.
  {
    label: "Jun 1 – 7",
    summary: { sessions: 5, liftLabel: "4h 48m", runLabel: "3.9 mi" },
    days: [
      {
        date: 1,
        inMonth: true,
        isToday: false,
        events: [lift("w1", "Week 4 Workout 1 - Arms", "6:10 PM", 29, 72)],
      },
      {
        date: 2,
        inMonth: true,
        isToday: false,
        events: [run("r1", "Base Run", "6:45 AM", 4.05, 38, "9:23", "Base")],
      },
      {
        date: 3,
        inMonth: true,
        isToday: false,
        events: [lift("w2", "Week 4 Workout 2 - Legs", "6:05 PM", 24, 68)],
      },
      empty(4),
      empty(5),
      {
        date: 6,
        inMonth: true,
        isToday: false,
        events: [lift("w3", "Week 4 Workout 3 - Push", "9:20 AM", 31, 74)],
      },
      {
        date: 7,
        inMonth: true,
        isToday: false,
        events: [lift("w4", "Week 4 Workout 4 - Pull", "9:40 AM", 27, 74)],
      },
    ],
  },
  // Week of Jun 8 — Recovery Week: Wed lift, Sat lift, Sun run.
  {
    label: "Jun 8 – 14",
    summary: { sessions: 3, liftLabel: "2h 32m", runLabel: "3.6 mi", stepsLabel: "11,000" },
    days: [
      empty(8),
      empty(9),
      {
        date: 10,
        inMonth: true,
        isToday: false,
        events: [lift("w5", "Recovery Week - Lift 1", "6:15 PM", 18, 46)],
      },
      empty(11),
      empty(12),
      {
        date: 13,
        inMonth: true,
        isToday: false,
        events: [lift("w6", "Recovery Week - Lift 2", "9:10 AM", 20, 46)],
      },
      {
        date: 14,
        inMonth: true,
        isToday: false,
        events: [run("r2", "Recovery Week - Run 1", "8:00 AM", 3.6, 36, "10:00", "Easy")],
      },
    ],
  },
  // Week of Jun 15 — today is Mon Jun 15 (done easy run). Jun 16 is dense.
  {
    label: "Jun 15 – 21",
    summary: { sessions: 1, runLabel: "4.2 mi", stepsLabel: "10,000" },
    days: [
      {
        date: 15,
        inMonth: true,
        isToday: true,
        events: [
          run("r3", "W7 D1 - Easy Run", "6:30 AM", 4.2, 41, "9:49", "Easy", { fromPlan: true }),
        ],
      },
      {
        date: 16,
        inMonth: true,
        isToday: false,
        events: [
          planned("p1", "run", "W7 D2 - Interval Run", "6:30 AM", { recurring: true }),
          planned("p2", "lift", "W5 D1 - Chest", "12:15 PM"),
          planned("p3", "mobility", "Mobility & Hips", "5:30 PM"),
          planned("p4", "core", "Core Circuit", "8:00 PM"),
        ],
      },
      empty(17),
      {
        date: 18,
        inMonth: true,
        isToday: false,
        events: [planned("p5", "lift", "W5 D2 - Back & Bis", "6:00 PM")],
      },
      empty(19),
      {
        date: 20,
        inMonth: true,
        isToday: false,
        events: [planned("p6", "run", "W7 D3 - Long Run", "7:30 AM")],
      },
      {
        date: 21,
        inMonth: true,
        isToday: false,
        events: [planned("p7", "lift", "W5 D3 - Legs", "9:30 AM", { recurring: true })],
      },
    ],
  },
  // Week of Jun 22 — empty.
  {
    label: "Jun 22 – 28",
    summary: { sessions: 0 },
    days: [22, 23, 24, 25, 26, 27, 28].map((d) => empty(d)),
  },
  // Week of Jun 29 — Jun 29–30 in month, Jul 1–5 trailing.
  {
    label: "Jun 29 – Jul 5",
    summary: { sessions: 0 },
    days: [
      empty(29),
      empty(30),
      empty(1, false),
      empty(2, false),
      empty(3, false),
      empty(4, false),
      empty(5, false),
    ],
  },
];

/** Convenience: the dense day, handy for callouts. */
export const DENSE_DAY = WEEKS[2].days[1];
