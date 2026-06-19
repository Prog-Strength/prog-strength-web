/**
 * Shared, throwaway fixtures + client-side derivation for the
 * steps-view design exploration.
 *
 * Per the DX ticket, the API returns only flat daily totals
 * (`{ date, steps }`) plus a single `goal`. EVERYTHING a variant wants to
 * show beyond that — the average, % of goal, per-day goal delta, the
 * goal-hit count / streak, the inline sparkline, the heat-cell intensity —
 * is derived HERE, client-side, so every variant renders the same derived
 * truth, diverging only on how it is composed.
 *
 * Dates are plain `YYYY-MM-DD` calendar days (no time-of-day). "Today" is
 * pinned to the ticket's reference day (Jun 18, 2026) so period cutoffs and
 * the "last N days" axis are deterministic regardless of the viewer's clock.
 */

export type StepsEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  steps: number;
};

export type Goal = {
  goal: number; // 0 ⇒ never set ⇒ "Set step goal"
};

export const GOAL: Goal = { goal: 10000 };
export const NO_GOAL: Goal = { goal: 0 };

/** Pinned "today" for the mockup — the ticket's reference day. */
export const TODAY = "2026-06-18";

// --- Fixture ---------------------------------------------------------
//
// ~30 days ending Jun 18, 2026, mirroring the ticket's representative
// window: avg riding just under the 10,000 goal (≈94%), a couple of
// strong days, a couple of clear misses, the one big day (Jun 18, 14,000)
// that must not flatten the rest, and TWO unlogged gaps (Jun 9, May 30)
// so every variant has to distinguish "didn't walk" from "didn't log".
// Newest first.
export const FIXTURE_ENTRIES: StepsEntry[] = [
  { id: "d0618", date: "2026-06-18", steps: 14000 },
  { id: "d0617", date: "2026-06-17", steps: 6500 },
  { id: "d0616", date: "2026-06-16", steps: 5500 },
  { id: "d0615", date: "2026-06-15", steps: 10000 },
  { id: "d0614", date: "2026-06-14", steps: 11000 },
  { id: "d0613", date: "2026-06-13", steps: 9500 },
  { id: "d0612", date: "2026-06-12", steps: 9200 },
  { id: "d0611", date: "2026-06-11", steps: 8800 },
  { id: "d0610", date: "2026-06-10", steps: 10400 },
  // Jun 9 — unlogged gap
  { id: "d0608", date: "2026-06-08", steps: 7600 },
  { id: "d0607", date: "2026-06-07", steps: 9800 },
  { id: "d0606", date: "2026-06-06", steps: 8600 },
  { id: "d0605", date: "2026-06-05", steps: 9900 },
  { id: "d0604", date: "2026-06-04", steps: 10100 },
  { id: "d0603", date: "2026-06-03", steps: 8200 },
  { id: "d0602", date: "2026-06-02", steps: 9400 },
  { id: "d0601", date: "2026-06-01", steps: 10600 },
  { id: "d0531", date: "2026-05-31", steps: 12000 },
  // May 30 — unlogged gap
  { id: "d0529", date: "2026-05-29", steps: 8400 },
  { id: "d0528", date: "2026-05-28", steps: 9100 },
  { id: "d0527", date: "2026-05-27", steps: 10800 },
  { id: "d0526", date: "2026-05-26", steps: 7300 },
  { id: "d0525", date: "2026-05-25", steps: 9600 },
  { id: "d0524", date: "2026-05-24", steps: 9000 },
  { id: "d0523", date: "2026-05-23", steps: 10200 },
  { id: "d0522", date: "2026-05-22", steps: 8700 },
  { id: "d0521", date: "2026-05-21", steps: 9300 },
  { id: "d0520", date: "2026-05-20", steps: 10000 },
];

/** Single-entry case — no average-vs-trend story yet. */
export const FIRST_ENTRY: StepsEntry[] = [{ id: "d0618", date: "2026-06-18", steps: 14000 }];

/** Empty case — zero entries. */
export const EMPTY: StepsEntry[] = [];

// --- Derivation ------------------------------------------------------

export type DataState = "month" | "first" | "empty";
export type Period = "7d" | "30d" | "90d" | "all";

export const PERIODS: { id: Period; label: string; days: number | null }[] = [
  { id: "7d", label: "Last 7 days", days: 7 },
  { id: "30d", label: "Last 30 days", days: 30 },
  { id: "90d", label: "Last 90 days", days: 90 },
  { id: "all", label: "All", days: null },
];

/** One continuous calendar day on the axis — present whether or not it
 * was logged, so chart / heatmap / ribbon can render a gap as a gap. */
export type Day = {
  date: string; // YYYY-MM-DD
  dow: number; // 0=Sun … 6=Sat
  label: string; // "Jun 18"
  weekday: string; // "Thu"
  steps: number | null; // null ⇒ unlogged gap (NOT a zero)
  logged: boolean;
  hit: boolean; // logged && goal>0 && steps>=goal
  pct: number | null; // steps/goal, null when no goal or unlogged
  delta: number | null; // steps − goal, null when no goal or unlogged
};

export type Stats = {
  avg: number | null;
  total: number;
  best: { date: string; steps: number } | null;
  daysLogged: number;
  daysHit: number;
  daysInPeriod: number;
  attainmentPct: number | null; // avg vs goal
  hitRatePct: number | null; // daysHit / daysLogged
  currentStreak: number; // trailing run of consecutive hits (most-recent-first)
};

const DAY_MS = 86_400_000;

function parseLocal(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function iso(d: Date): string {
  const y = String(d.getFullYear()).padStart(4, "0");
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Entries within the active period, newest first. */
export function entriesInPeriod(entries: StepsEntry[], period: Period): StepsEntry[] {
  const days = PERIODS.find((p) => p.id === period)?.days ?? null;
  if (days === null) return [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const cutoff = iso(new Date(parseLocal(TODAY).getTime() - (days - 1) * DAY_MS));
  return entries.filter((e) => e.date >= cutoff).sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * The continuous day axis for the period, oldest → newest. Every calendar
 * day from the window start to TODAY appears; days with no entry are
 * `steps: null` (a gap, never a 0). When the period is `all` the axis runs
 * from the earliest logged day to TODAY.
 */
export function buildAxis(entries: StepsEntry[], period: Period, goal: number): Day[] {
  if (entries.length === 0) return [];
  const byDate = new Map(entries.map((e) => [e.date, e.steps]));
  const today = parseLocal(TODAY);
  const days = PERIODS.find((p) => p.id === period)?.days ?? null;
  let start: Date;
  if (days === null) {
    const earliest = entries.reduce((min, e) => (e.date < min ? e.date : min), entries[0].date);
    start = parseLocal(earliest);
  } else {
    start = new Date(today.getTime() - (days - 1) * DAY_MS);
  }
  const out: Day[] = [];
  for (let t = start.getTime(); t <= today.getTime(); t += DAY_MS) {
    const d = new Date(t);
    const date = iso(d);
    const steps = byDate.has(date) ? (byDate.get(date) as number) : null;
    const logged = steps !== null;
    const hit = logged && goal > 0 && steps >= goal;
    out.push({
      date,
      dow: d.getDay(),
      label: `${MONTHS[d.getMonth()]} ${d.getDate()}`,
      weekday: WEEKDAYS[d.getDay()],
      steps,
      logged,
      hit,
      pct: logged && goal > 0 ? steps / goal : null,
      delta: logged && goal > 0 ? steps - goal : null,
    });
  }
  return out;
}

export function deriveStats(entries: StepsEntry[], period: Period, goal: number): Stats {
  const inPeriod = entriesInPeriod(entries, period);
  const axis = buildAxis(entries, period, goal);
  if (inPeriod.length === 0) {
    return {
      avg: null,
      total: 0,
      best: null,
      daysLogged: 0,
      daysHit: 0,
      daysInPeriod: axis.length,
      attainmentPct: null,
      hitRatePct: null,
      currentStreak: 0,
    };
  }
  let total = 0;
  let best = inPeriod[0];
  for (const e of inPeriod) {
    total += e.steps;
    if (e.steps > best.steps) best = e;
  }
  const avg = total / inPeriod.length;
  const daysHit = goal > 0 ? inPeriod.filter((e) => e.steps >= goal).length : 0;

  // Current streak: walk the continuous axis from newest backward, counting
  // consecutive hits. A gap or a miss breaks it. (No goal ⇒ no streak.)
  let currentStreak = 0;
  if (goal > 0) {
    for (let i = axis.length - 1; i >= 0; i--) {
      if (axis[i].hit) currentStreak++;
      else break;
    }
  }

  return {
    avg,
    total,
    best: { date: best.date, steps: best.steps },
    daysLogged: inPeriod.length,
    daysHit,
    daysInPeriod: axis.length,
    attainmentPct: goal > 0 ? Math.round((avg / goal) * 100) : null,
    hitRatePct: goal > 0 ? Math.round((daysHit / inPeriod.length) * 100) : null,
    currentStreak,
  };
}

/** Runs of consecutive hits / misses across the axis (for streak-momentum).
 * Gaps end the current run and are emitted as their own `gap` runs. */
export type Run = { kind: "hit" | "miss" | "gap"; days: Day[] };

export function buildRuns(axis: Day[]): Run[] {
  const runs: Run[] = [];
  for (const d of axis) {
    const kind: Run["kind"] = !d.logged ? "gap" : d.hit ? "hit" : "miss";
    const last = runs[runs.length - 1];
    if (last && last.kind === kind) last.days.push(d);
    else runs.push({ kind, days: [d] });
  }
  return runs;
}

/** Calendar weeks (Sun-started) padded to align the heatmap grid. */
export type CalWeek = { cells: (Day | null)[] };

export function buildWeeks(axis: Day[]): CalWeek[] {
  if (axis.length === 0) return [];
  const weeks: CalWeek[] = [];
  let cells: (Day | null)[] = [];
  // Pad leading blanks so the first day lands under its weekday column.
  for (let i = 0; i < axis[0].dow; i++) cells.push(null);
  for (const d of axis) {
    cells.push(d);
    if (d.dow === 6) {
      weeks.push({ cells });
      cells = [];
    }
  }
  if (cells.length) {
    while (cells.length < 7) cells.push(null);
    weeks.push({ cells });
  }
  return weeks;
}

// --- Formatting ------------------------------------------------------

export function fmt(n: number): string {
  return Math.round(n).toLocaleString();
}

/** Compact "9.4k" form for tight chips / axes. */
export function fmtK(n: number): string {
  if (n < 1000) return String(Math.round(n));
  const k = n / 1000;
  return `${k % 1 === 0 ? k : k.toFixed(1)}k`;
}

export function fmtSigned(n: number): string {
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmt(Math.abs(n))}`;
}

export function shortDate(date: string): string {
  const d = parseLocal(date);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function rowDate(date: string): string {
  const d = parseLocal(date);
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export { parseLocal };
