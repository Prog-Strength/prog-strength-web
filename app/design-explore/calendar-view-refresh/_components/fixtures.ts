/**
 * Static fixtures + shared design tokens for the calendar-view-refresh DX.
 *
 * THROWAWAY: this is mockup data for a Design Exploration comparison route.
 * It is intentionally NOT wired to lib/api.ts or any data service — the DX
 * brief asks for "static fixtures that look real" so all four variants render
 * the same realistic month without backends.
 *
 * The month is June 2026 (starts on a Monday) reproduced from the DX ticket's
 * representative fixture: a completed first half, a planned second half, a
 * dense day (Jun 16, four stacked planned sessions), a recovery week, and two
 * empty weeks. "Today" is pinned to Mon Jun 15 2026 so the mockup is stable.
 */

export const TODAY_ISO = "2026-06-15";
export const MONTH_YEAR = 2026;
export const MONTH_INDEX = 5; // June (0-based)

export type Discipline = "run" | "lift";
export type EventState = "logged" | "planned" | "completed-planned";

export interface CalEvent {
  id: string;
  date: string; // YYYY-MM-DD (local)
  discipline: Discipline;
  state: EventState;
  title: string;
  time: string; // "5:00 PM"
  startMin: number; // minutes from midnight, for ordering
  summary: string; // one-line digest
  distanceMi?: number;
  durationMin?: number;
}

export const EVENTS: CalEvent[] = [
  // ── Week of Jun 1 — 5 activities (completed) ──────────────────────────
  {
    id: "e1",
    date: "2026-06-01",
    discipline: "lift",
    state: "logged",
    title: "W3 D1 — Lower Body",
    time: "6:30 AM",
    startMin: 390,
    summary: "Squat focus · 5 exercises · 72 min",
    durationMin: 72,
  },
  {
    id: "e2",
    date: "2026-06-02",
    discipline: "run",
    state: "logged",
    title: "Easy Run",
    time: "7:10 AM",
    startMin: 430,
    summary: "3.0 mi · 9:58 /mi · zone 2",
    distanceMi: 3.0,
    durationMin: 30,
  },
  {
    id: "e3",
    date: "2026-06-03",
    discipline: "lift",
    state: "completed-planned",
    title: "W3 D2 — Upper Body",
    time: "6:25 AM",
    startMin: 385,
    summary: "Planned → done · 6 exercises · 64 min",
    durationMin: 64,
  },
  {
    id: "e4",
    date: "2026-06-06",
    discipline: "lift",
    state: "logged",
    title: "W3 D3 — Full Body",
    time: "9:05 AM",
    startMin: 545,
    summary: "Deadlift + accessories · 81 min",
    durationMin: 81,
  },
  {
    id: "e5",
    date: "2026-06-07",
    discipline: "lift",
    state: "logged",
    title: "W3 D4 — Conditioning",
    time: "9:30 AM",
    startMin: 570,
    summary: "Circuit · kettlebell · 51 min",
    durationMin: 51,
  },

  // ── Week of Jun 8 — Recovery Week, 3 activities ───────────────────────
  {
    id: "e6",
    date: "2026-06-10",
    discipline: "lift",
    state: "logged",
    title: "Recovery Week — Mobility + Light Lift",
    time: "7:00 AM",
    startMin: 420,
    summary: "Light load · mobility flow · 44 min",
    durationMin: 44,
  },
  {
    id: "e7",
    date: "2026-06-13",
    discipline: "lift",
    state: "logged",
    title: "Recovery Week — Light Full Body",
    time: "9:15 AM",
    startMin: 555,
    summary: "60% effort · technique · 48 min",
    durationMin: 48,
  },
  {
    id: "e8",
    date: "2026-06-14",
    discipline: "run",
    state: "logged",
    title: "Recovery Week — Easy Jog",
    time: "8:00 AM",
    startMin: 480,
    summary: "3.6 mi · 10:21 /mi · conversational",
    distanceMi: 3.6,
    durationMin: 37,
  },

  // ── Week of Jun 15 — today is Mon Jun 15; Jun 16 is dense ─────────────
  {
    id: "e9",
    date: "2026-06-15",
    discipline: "run",
    state: "logged",
    title: "Easy Run",
    time: "6:45 AM",
    startMin: 405,
    summary: "4.2 mi · 9:49 /mi · zone 2",
    distanceMi: 4.2,
    durationMin: 41,
  },
  // Jun 16 — four stacked planned sessions (the dense day)
  {
    id: "e10",
    date: "2026-06-16",
    discipline: "run",
    state: "planned",
    title: "W7 D2 — Interval Run",
    time: "6:00 AM",
    startMin: 360,
    summary: "6 × 800 m @ 5K pace · 2 min jog",
    distanceMi: 5.0,
    durationMin: 45,
  },
  {
    id: "e11",
    date: "2026-06-16",
    discipline: "lift",
    state: "planned",
    title: "W5 D1 — Chest & Back",
    time: "5:00 PM",
    startMin: 1020,
    summary: "6 exercises · push/pull · superset finisher",
    durationMin: 90,
  },
  {
    id: "e12",
    date: "2026-06-16",
    discipline: "lift",
    state: "planned",
    title: "Mobility Flow",
    time: "7:00 PM",
    startMin: 1140,
    summary: "Thoracic + hips · 20 min",
    durationMin: 20,
  },
  {
    id: "e13",
    date: "2026-06-16",
    discipline: "lift",
    state: "planned",
    title: "Core Finisher",
    time: "8:00 PM",
    startMin: 1200,
    summary: "Anti-rotation · 4 rounds · 15 min",
    durationMin: 15,
  },
  {
    id: "e14",
    date: "2026-06-18",
    discipline: "lift",
    state: "planned",
    title: "W5 D2 — Legs",
    time: "6:30 AM",
    startMin: 390,
    summary: "Front squat · RDL · 5 exercises",
    durationMin: 75,
  },
  {
    id: "e15",
    date: "2026-06-20",
    discipline: "lift",
    state: "planned",
    title: "W5 D3 — Push / Pull",
    time: "9:00 AM",
    startMin: 540,
    summary: "Overhead press · rows · 6 exercises",
    durationMin: 70,
  },
  {
    id: "e16",
    date: "2026-06-21",
    discipline: "run",
    state: "planned",
    title: "Long Run",
    time: "7:30 AM",
    startMin: 450,
    summary: "8.0 mi · easy aerobic · fuel practice",
    distanceMi: 8.0,
    durationMin: 78,
  },
  // Weeks of Jun 22 and Jun 29 are intentionally empty (0 activities).
];

/** The worked example the modals/panels render (DX ticket: W5 D1). */
export const WORKED_EVENT_ID = "e11";

export interface AgendaExercise {
  name: string;
  muscles: string[];
  sets: string; // "4 × 8"
  supersetGroup?: string; // exercises sharing a group are bound as a superset
}

export const WORKED_AGENDA: AgendaExercise[] = [
  { name: "Barbell Bench Press", muscles: ["Chest", "Shoulders"], sets: "4 × 8" },
  { name: "Barbell Bent Over Row", muscles: ["Back"], sets: "4 × 8" },
  { name: "Incline Dumbbell Bench Press", muscles: ["Chest"], sets: "3 × 10" },
  { name: "Dumbbell Tripod Row", muscles: ["Back"], sets: "3 × 10" },
  { name: "Machine Fly", muscles: ["Chest"], sets: "3 × 12", supersetGroup: "A" },
  { name: "Pull Up", muscles: ["Back"], sets: "3 × max", supersetGroup: "A" },
];

export interface WeekStat {
  weekStartISO: string;
  label: string; // "Jun 1 – 7"
  trained: number; // days trained
  dots: boolean[]; // 7, Mon→Sun
  lift: string; // "4h 48m"
  run: string; // "3.9 mi"
  steps?: string; // "11,000"
  note?: string; // coaching line / recovery flag
}

export const WEEK_STATS: WeekStat[] = [
  {
    weekStartISO: "2026-06-01",
    label: "Jun 1 – 7",
    trained: 5,
    dots: [true, true, true, false, false, true, true],
    lift: "4h 48m",
    run: "3.9 mi",
    note: "Strong week — 5 of 7 days.",
  },
  {
    weekStartISO: "2026-06-08",
    label: "Jun 8 – 14",
    trained: 3,
    dots: [false, false, true, false, false, true, true],
    lift: "2h 32m",
    run: "3.6 mi",
    steps: "11,000",
    note: "Recovery week — recovery counts too.",
  },
  {
    weekStartISO: "2026-06-15",
    label: "Jun 15 – 21",
    trained: 1,
    dots: [true, false, false, false, false, false, false],
    lift: "0h 00m",
    run: "4.2 mi",
    steps: "10,000",
    note: "1 day in · 5 planned ahead.",
  },
  {
    weekStartISO: "2026-06-22",
    label: "Jun 22 – 28",
    trained: 0,
    dots: [false, false, false, false, false, false, false],
    lift: "0h 00m",
    run: "0 mi",
    note: "Nothing logged yet — open week.",
  },
  {
    weekStartISO: "2026-06-29",
    label: "Jun 29 – Jul 5",
    trained: 0,
    dots: [false, false, false, false, false, false, false],
    lift: "0h 00m",
    run: "0 mi",
    note: "Plan the week ahead.",
  },
];

/** Six hero stats for the visible month. */
export const MONTH_STATS: { label: string; value: string }[] = [
  { label: "Lift Time", value: "7h 20m" },
  { label: "Run Time", value: "1h 55m" },
  { label: "Run Distance", value: "11.7 mi" },
  { label: "Avg Pace", value: "9:49 /mi" },
  { label: "Longest Run", value: "4.2 mi" },
  { label: "Activities", value: "9" },
];

// ── Month matrix (month-bounded, Monday-first) ──────────────────────────
// Built generically so the "month stops where the month stops" fix is
// structural: leading/trailing days appear only as greyed cells inside the
// first and last week rows, and the matrix never spills into extra rows.

export interface DayCell {
  iso: string;
  dayNum: number;
  inMonth: boolean;
  isToday: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");
export const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function buildMonthWeeks(year: number, monthIdx: number): DayCell[][] {
  const first = new Date(year, monthIdx, 1);
  const mondayOffset = (first.getDay() + 6) % 7; // days from prev month
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();

  const cells: DayCell[] = [];
  const push = (d: Date, inMonth: boolean) =>
    cells.push({ iso: isoOf(d), dayNum: d.getDate(), inMonth, isToday: isoOf(d) === TODAY_ISO });

  for (let i = mondayOffset; i > 0; i--) push(new Date(year, monthIdx, 1 - i), false);
  for (let day = 1; day <= daysInMonth; day++) push(new Date(year, monthIdx, day), true);
  // Only pad the final partial week — never add a whole extra row.
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1];
    const [ly, lm, ld] = last.iso.split("-").map(Number);
    push(new Date(ly, lm - 1, ld + 1), false);
  }

  const weeks: DayCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export const MONTH_WEEKS = buildMonthWeeks(MONTH_YEAR, MONTH_INDEX);

export const eventsByDate = (iso: string) =>
  EVENTS.filter((e) => e.date === iso).sort((a, b) => a.startMin - b.startMin);

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── Re-toned activity tonal hues ────────────────────────────────────────
// In-system: slate + violet (var(--accent)) + Nunito are fixed. These are the
// *activity tonal hues* the design system calls for — per-discipline,
// desaturated, re-toned to sit on dark slate, and deliberately NOT the legacy
// warm amber/clay. run = cool teal, lift = cool periwinkle. Violet is reserved
// for today / selection / primary action, never spent on a discipline.
export const HUE: Record<Discipline, { fg: string; dot: string; bg: string; line: string }> = {
  run: {
    fg: "#86cabf",
    dot: "#4fb3a6",
    bg: "rgba(79, 179, 166, 0.13)",
    line: "rgba(79, 179, 166, 0.36)",
  },
  lift: {
    fg: "#a3b7ea",
    dot: "#6f8fd6",
    bg: "rgba(111, 143, 214, 0.14)",
    line: "rgba(111, 143, 214, 0.36)",
  },
};

export const disciplineLabel = (d: Discipline) => (d === "run" ? "Run" : "Lift");
