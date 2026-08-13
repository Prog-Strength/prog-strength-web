/**
 * `season-rail` — scrub the whole history. THROWAWAY design exploration.
 *
 * Reference products: Whoop's trend calendar and the GitHub contribution graph
 * — a horizontal wall of one cell per stored morning, read at a squint from
 * across the room and brushed like a scrubber. The rail is the page's single
 * densest colour moment AND its navigation: it REPLACES the `7d · 30d · 90d`
 * toggle with a continuous one, so there is no range toggle anywhere.
 *
 * Score treatment: THERE IS NO SCORE CHART, deliberately. The rail IS the score
 * chart — every morning is a cell in its canonical Whoop band
 * (`recoveryBandColor(recoveryBand(score))`), hollow where a night was never
 * recorded, a short muted stub where the morning has readings but no score. A
 * second banded chart beneath would say the same thing twice.
 *
 * RHR treatment: A BANDED RIBBON MATCHING HRV'S FORM — the same drifting band
 * polygon, the same 7-day rolling hairline, the same circle / apex-down
 * triangle / diamond marks, coloured through `hrvStatusColor`. This is the
 * variant's argument: if "the page should feel coherent" means all three
 * metrics drawn alike, this is what that looks like.
 *
 * P2: REQUIRED. The payload carries no resting-HR spread, no per-day RHR band
 * and no per-day RHR classification. Every figure that ribbon needs is computed
 * in ONE function — `proposedRestingBand` — which exists only so the picture can
 * be judged, and the panel says so on its face. See that function's docstring.
 *
 * Distinct because: it is the only variant that treats ALL stored history as a
 * single navigable surface rather than a paged list — colour wall first, then
 * calm monochrome panels beneath — and the only one whose selection commits an
 * API SOW.
 */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import Link from "next/link";

import type { RecoveryDayPoint, RecoveryHrvStatus, RecoveryView } from "@/lib/dashboard";
import { useMeasuredWidth } from "@/lib/use-measured-width";
import {
  MIN_BASELINE_DAYS,
  hrvStatusColor,
  recoveryBand,
  recoveryBandColor,
  recoveryBandWord,
} from "@/app/(app)/dashboard/_components/recovery/shared";
import { HrvPanel } from "../_components/hrv-panel";
import {
  LEDGER_PAGE_SIZE,
  bandCounts,
  extent,
  isMissingNight,
  isMonthStart,
  ledgerRows,
  longDate,
  mean,
  monthLabel,
  monthYear,
  pageCount,
  pageOf,
  parseISO,
  round,
  shortDate,
  windowView,
  yScale,
} from "../_shared";

const PANEL = "rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]";
const KICKER = "text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--faint)]";

/** The rail's cell height. Tall enough to read a band from across the room,
 *  short enough that 428 of them are still a strip and not a block. */
const RAIL_H = 38;

/** A drag shorter than this is not a range — it is a slip of the hand. */
const MIN_BRUSH = 7;
/** A click with no drag re-centres this many mornings on the clicked cell. */
const CLICK_WINDOW = 30;
const DEFAULT_BRUSH = 90;

/**
 * The default brush ENDS SIXTY MORNINGS BACK rather than on today, and that is
 * deliberate twice over. Fixed Decision 4 wants the ledger rendered at a real
 * mid-state page, and on this variant the pager follows the brush — a brush
 * ending on today would land it on page 1 of 21. And Fixed Decision 1 says the
 * page's subject is a stretch of history, not this morning; opening on one
 * makes that argument before a word is read. Today still gets its own line.
 */
const DEFAULT_OFFSET = 60;

type Brush = { from: number; to: number };

function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.min(hi, Math.max(lo, v));
}

function recordedCount(days: RecoveryDayPoint[]): number {
  return days.filter((d) => !isMissingNight(d)).length;
}

function defaultBrush(days: RecoveryDayPoint[]): Brush {
  const n = days.length;
  if (n === 0) return { from: 0, to: 0 };
  if (n <= DEFAULT_BRUSH) return { from: 0, to: n - 1 };
  const latest = { from: n - DEFAULT_BRUSH, to: n - 1 };
  const to = n - 1 - DEFAULT_OFFSET;
  if (to < DEFAULT_BRUSH - 1) return latest;
  const back = { from: to - DEFAULT_BRUSH + 1, to };
  // The sparse-year state has nothing at all back there. Opening on 90 empty
  // mornings reads as breakage rather than as history-not-yet-recorded, so fall
  // back to the most recent stretch when the historical one holds almost nothing.
  return recordedCount(days.slice(back.from, back.to + 1)) >= 20 ? back : latest;
}

/** Resolve a raw drag into a legal selection: a bare click becomes a 30-day
 *  window centred on the cell, anything under a week widens to a week. */
function settle(b: Brush, n: number): Brush {
  if (n <= 0) return { from: 0, to: 0 };
  const hi = clamp(b.to, 0, n - 1);
  const lo = clamp(b.from, 0, hi);
  const span = hi - lo + 1;
  const want =
    span <= 1 ? Math.min(CLICK_WINDOW, n) : span < MIN_BRUSH ? Math.min(MIN_BRUSH, n) : span;
  if (want === span) return { from: lo, to: hi };
  const centre = Math.round((lo + hi) / 2);
  const from = clamp(centre - Math.floor(want / 2), 0, n - want);
  return { from, to: from + want - 1 };
}

/**
 * The ledger page holding the brush's NEWEST RECORDED morning — how Fixed
 * Decision 4's pager and the rail stay one control. Missing nights are skipped
 * because they have no row to land on; a brush of nothing but strap-off nights
 * leaves the pager where the ledger starts.
 */
function pageHolding(
  days: RecoveryDayPoint[],
  rows: RecoveryDayPoint[],
  lo: number,
  hi: number,
  totalPages: number,
): number {
  for (let i = hi; i >= lo; i -= 1) {
    const day = days[i];
    if (!day || isMissingNight(day)) continue;
    const idx = rows.findIndex((r) => r.date === day.date);
    if (idx >= 0) return clamp(Math.floor(idx / LEDGER_PAGE_SIZE) + 1, 1, totalPages);
  }
  return 1;
}

// ── P2 ────────────────────────────────────────────────────────────────────────

type ProposedRestingPoint = {
  date: string;
  rhr: number | null;
  low: number | null;
  high: number | null;
  rolling: number | null;
  /** Reusing the HRV status union so the marks can go straight through
   *  `hrvStatusColor` — the grammar is the whole point of the ribbon. */
  status: RecoveryHrvStatus;
};

const PROPOSED_WINDOW = 30;
const PROPOSED_SHORT = 7;
const PROPOSED_SHORT_MIN = 4;

/**
 * THE ONE DELIBERATE EXCEPTION TO "NOTHING RECOMPUTES A SERVER FIGURE", AND IT
 * IS DECLARED ON THE PAGE RATHER THAN SMUGGLED.
 *
 * This is the figure prerequisite **P2** would have `internal/recoverytrend`
 * emit: a resting-HR spread and a per-day band, exactly as it already does for
 * HRV. It is computed here ONLY so the picture can be judged. A real
 * implementation reads it off the payload and computes nothing. Selecting this
 * variant is a decision to fund that API work.
 *
 * Everything the RHR ribbon draws — the band, the rolling curve and the per-day
 * classification — comes out of this one function, so the whole of the invented
 * arithmetic is in one place and deleting it deletes the debt. Nothing else in
 * this file derives a band, and no other metric gets this treatment.
 *
 * The status mapping is HRV's, unchanged: below band → `suppressed` (warning),
 * above band → `elevated` (accent), inside → `balanced` (success). Whether a
 * LOW resting morning should really read as warning is precisely the sort of
 * question the server work would have to settle.
 */
function proposedRestingBand(days: RecoveryDayPoint[]): ProposedRestingPoint[] {
  return days.map((day, i) => {
    const window = days
      .slice(Math.max(0, i - PROPOSED_WINDOW + 1), i + 1)
      .flatMap((d) => (d.restingHr === null ? [] : [d.restingHr]));
    const avg =
      window.length >= MIN_BASELINE_DAYS
        ? window.reduce((sum, v) => sum + v, 0) / window.length
        : null;

    let low: number | null = null;
    let high: number | null = null;
    if (avg !== null) {
      const variance = window.reduce((sum, v) => sum + (v - avg) * (v - avg), 0) / window.length;
      const sd = Math.sqrt(variance);
      low = avg - sd;
      high = avg + sd;
    }

    const short = days
      .slice(Math.max(0, i - PROPOSED_SHORT + 1), i + 1)
      .flatMap((d) => (d.restingHr === null ? [] : [d.restingHr]));
    const rolling =
      short.length >= PROPOSED_SHORT_MIN
        ? short.reduce((sum, v) => sum + v, 0) / short.length
        : null;

    let status: RecoveryHrvStatus = "unknown";
    if (day.restingHr !== null && low !== null && high !== null) {
      status = day.restingHr < low ? "suppressed" : day.restingHr > high ? "elevated" : "balanced";
    }

    return { date: day.date, rhr: day.restingHr, low, high, rolling, status };
  });
}

// ── The page ──────────────────────────────────────────────────────────────────

export function SeasonRailVariant({ view }: { view: RecoveryView }) {
  const days = useMemo(() => view.days ?? [], [view.days]);
  const n = days.length;

  const [brush, setBrush] = useState<Brush>(() => defaultBrush(days));
  const [dragging, setDragging] = useState(false);
  const [nudge, setNudge] = useState<number | null>(null);
  const anchor = useRef(0);

  // Clamped on READ, so a fixture swap that shortens the history under a live
  // brush can never index past the end of the array.
  const hi = n === 0 ? 0 : clamp(brush.to, 0, n - 1);
  const lo = n === 0 ? 0 : clamp(brush.from, 0, hi);
  const brushed = days.slice(lo, hi + 1);
  const span = brushed.length;

  // A drag that ends off the rail — or off the window — still has to finish.
  useEffect(() => {
    if (!dragging) return;
    function end() {
      setDragging(false);
      setBrush((b) => settle(b, n));
      setNudge(null);
    }
    window.addEventListener("mouseup", end);
    return () => window.removeEventListener("mouseup", end);
  }, [dragging, n]);

  function select(next: Brush) {
    setBrush(next);
    // The pager follows the brush again the moment the brush moves.
    setNudge(null);
  }

  function indexAt(rect: DOMRect, clientX: number): number {
    if (n <= 1 || rect.width <= 0) return 0;
    return clamp(Math.floor(((clientX - rect.left) / rect.width) * n), 0, n - 1);
  }

  function onDown(event: MouseEvent<HTMLDivElement>) {
    if (n === 0) return;
    event.preventDefault();
    const i = indexAt(event.currentTarget.getBoundingClientRect(), event.clientX);
    anchor.current = i;
    setDragging(true);
    select({ from: i, to: i });
  }

  function onMove(event: MouseEvent<HTMLDivElement>) {
    if (!dragging || n === 0) return;
    const i = indexAt(event.currentTarget.getBoundingClientRect(), event.clientX);
    select({ from: Math.min(anchor.current, i), to: Math.max(anchor.current, i) });
  }

  function onUp() {
    if (!dragging) return;
    setDragging(false);
    setBrush((b) => settle(b, n));
  }

  const shortcuts = [
    { label: "last 30", size: 30 },
    { label: "last 90", size: 90 },
    { label: "last year", size: 365 },
    { label: "all", size: n },
  ];

  // The month ruler. Every boundary gets a tick; on a rail holding more than ten
  // months only alternate months get a label, so nothing collides.
  const ticks = useMemo(() => {
    const marks = days.flatMap((d, i) => (isMonthStart(d.date) ? [{ i, iso: d.date }] : []));
    const stride = marks.length > 10 ? 2 : 1;
    return marks.map((m, k) => {
      // January always keeps its label whatever the stride — it is the only
      // tick that carries a year, and a rail spanning one is unreadable without.
      const january = parseISO(m.iso).getMonth() === 0;
      if (k % stride !== 0 && !january) return { i: m.i, label: null };
      return { i: m.i, label: k === 0 || january ? monthYear(m.iso) : monthLabel(m.iso) };
    });
  }, [days]);

  // ── The window figures. Averages over the BRUSH, never over "today". ────────
  const recordedAll = recordedCount(days);
  const recordedBrush = recordedCount(brushed);
  const calibrating = recordedAll < MIN_BASELINE_DAYS;

  const figures = [
    {
      name: "score",
      unit: undefined,
      avg: mean(brushed.map((d) => d.recoveryScore)),
      readings: brushed.filter((d) => d.recoveryScore !== null).length,
    },
    {
      name: "resting hr",
      unit: "bpm",
      avg: mean(brushed.map((d) => d.restingHr)),
      readings: brushed.filter((d) => d.restingHr !== null).length,
    },
    {
      name: "hrv",
      unit: "ms",
      avg: mean(brushed.map((d) => d.hrv)),
      readings: brushed.filter((d) => d.hrv !== null).length,
    },
  ];

  const counts = bandCounts(brushed);
  const chips = [
    { band: "green", count: counts.green },
    { band: "yellow", count: counts.yellow },
    { band: "red", count: counts.red },
  ] as const;

  const rangeLabel =
    n === 0
      ? "no stored mornings yet"
      : `${shortDate(days[lo].date)} – ${shortDate(days[hi].date)} ${parseISO(
          days[hi].date,
        ).getFullYear()} · ${
          recordedBrush === span ? `${span} mornings` : `${span} days · ${recordedBrush} recorded`
        }`;

  // Today is the last stored slot, never `new Date()`.
  const todayPoint = n === 0 ? null : days[n - 1];
  const todayLine =
    todayPoint === null || isMissingNight(todayPoint)
      ? "today hasn't landed yet"
      : todayPoint.recoveryScore === null
        ? `today · no score yet · ${round(todayPoint.restingHr)} bpm`
        : `today · ${Math.round(todayPoint.recoveryScore)} · ${recoveryBandWord(
            recoveryBand(todayPoint.recoveryScore),
          )}`;

  // ── P2's ribbon, over the whole history so the brush's first morning has a
  //    warm band behind it rather than a cold-started one. ─────────────────────
  const proposed = useMemo(() => proposedRestingBand(days), [days]);
  const proposedBrush = proposed.slice(lo, hi + 1);
  const lastBanded = [...proposedBrush].reverse().find((p) => p.low !== null && p.high !== null);
  const boundsLine =
    lastBanded && lastBanded.low !== null && lastBanded.high !== null
      ? `proposed band · ${Math.round(lastBanded.low)}–${Math.round(
          lastBanded.high,
        )} bpm · ±1 sd of the trailing ${PROPOSED_WINDOW}`
      : `no proposed band yet · ${recordedAll} of ${MIN_BASELINE_DAYS} mornings`;

  // ── The ledger, over ALL stored history, its page following the brush. ──────
  const rows = useMemo(() => ledgerRows(days), [days]);
  const totalPages = pageCount(rows.length);
  const brushPage = pageHolding(days, rows, lo, hi, totalPages);
  const page = clamp(nudge ?? brushPage, 1, totalPages);
  const pageRows = pageOf(rows, page);
  const firstBrushed = n === 0 ? "" : days[lo].date;
  const lastBrushed = n === 0 ? "" : days[hi].date;

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-6 py-8">
      {/* 1 — a minimal header. No range toggle: the rail is the range control. */}
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-[var(--foreground)]">
          Recovery
        </h1>
        <p className="text-[11px] text-[var(--muted)]">
          Every morning Whoop has recorded for you, as one surface.
        </p>
        <p className="mt-1 text-[10px] text-[var(--faint)]">
          the rail is the range control — drag to select a stretch
        </p>
      </header>

      {/* 2 — THE RAIL. One cell per stored morning, and the page's navigation. */}
      <section className={`${PANEL} p-3`}>
        <div
          className="relative select-none"
          style={{ cursor: n > 1 ? "col-resize" : "default" }}
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          role="presentation"
        >
          {/* The 1px gutter between cells is what makes a month of mornings read
              as a row of days rather than as a bar. Past ~180 cells it stops
              paying for itself and starts eating the colour: at fourteen months
              the gutters would be a third of the rail's width and the wall would
              read washed out. So the rail closes up as it lengthens. */}
          <div
            className={`flex w-full items-stretch ${days.length > 180 ? "gap-0" : "gap-px"}`}
            style={{ height: RAIL_H }}
          >
            {days.map((d, i) => (
              <RailCell key={d.date} day={d} dim={i < lo || i > hi} />
            ))}
          </div>
          {n > 0 && (
            <div
              className="pointer-events-none absolute inset-y-0"
              style={{ left: `${(lo / n) * 100}%`, width: `${(span / n) * 100}%` }}
            >
              <div className="absolute inset-0 rounded-[2px] border border-[var(--accent-line)]" />
              <span className="absolute left-0 top-[-3px] h-[44px] w-[2px] rounded-full bg-[var(--accent)]" />
              <span className="absolute right-0 top-[-3px] h-[44px] w-[2px] rounded-full bg-[var(--accent)]" />
            </div>
          )}
        </div>

        {/* the month ruler */}
        <div className="relative mt-1.5 h-[16px]">
          {n > 0 &&
            ticks.map((t) => (
              <div
                key={t.i}
                className="absolute top-0"
                style={{ left: `${((t.i + 0.5) / n) * 100}%` }}
              >
                <span className="block h-[4px] w-px bg-[var(--border-strong)]" />
                {t.label && (
                  <span className="absolute left-[3px] top-[3px] whitespace-nowrap text-[9px] uppercase tracking-[0.12em] text-[var(--faint)]">
                    {t.label}
                  </span>
                )}
              </div>
            ))}
        </div>

        {/* escape hatches — shortcuts, not a segmented toggle */}
        <div className="mt-2 flex items-center justify-end gap-2 text-[10px]">
          {shortcuts.map((s, i) => (
            <span key={s.label} className="flex items-center gap-2">
              {i > 0 && <span className="text-[var(--faint)]">·</span>}
              <button
                type="button"
                className="text-[var(--accent)] hover:underline"
                onClick={() =>
                  select(
                    settle(
                      { from: Math.max(0, n - Math.max(1, s.size)), to: Math.max(0, n - 1) },
                      n,
                    ),
                  )
                }
              >
                {s.label}
              </button>
            </span>
          ))}
        </div>
      </section>

      {/* 3 — THE HERO: what this stretch of time has been like. */}
      <section className="border-y border-[var(--border)] py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-[13px] tabular-nums text-[var(--foreground)]">{rangeLabel}</span>
          <span className="text-[11px] text-[var(--muted)]">{todayLine}</span>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-x-12 gap-y-5">
          {figures.map((f) => {
            const showAvg = !calibrating && f.avg !== null;
            return (
              <div key={f.name}>
                <div className="flex items-baseline gap-1">
                  <span className="text-[32px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-[var(--foreground)]">
                    {showAvg && f.avg !== null ? Math.round(f.avg) : f.readings}
                  </span>
                  {showAvg && f.unit && (
                    <span className="text-[11px] font-medium text-[var(--muted)]">{f.unit}</span>
                  )}
                </div>
                <div className={`mt-1.5 ${KICKER}`}>
                  {showAvg ? `${f.name} · brush avg` : `${f.name} readings in stretch`}
                </div>
              </div>
            );
          })}

          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {chips.map((chip) => (
              <span
                key={chip.band}
                className="rounded-[var(--radius-pill)] px-2.5 py-1 text-[11px] font-medium lowercase tabular-nums"
                style={{
                  color: recoveryBandColor(chip.band),
                  backgroundColor: `color-mix(in srgb, ${recoveryBandColor(
                    chip.band,
                  )} 13%, transparent)`,
                }}
              >
                {chip.count} {recoveryBandWord(chip.band)}
              </span>
            ))}
          </div>
        </div>

        {calibrating && (
          <p className="mt-3 text-[10px] text-[var(--faint)]">
            {recordedAll} of {MIN_BASELINE_DAYS} mornings · averages appear once Whoop knows your
            spread
          </p>
        )}
      </section>

      {/* 4 — where a score chart would go. */}
      <div className="flex items-start gap-3">
        <span className={`${KICKER} shrink-0 pt-px`}>score</span>
        <p className="text-[10px] leading-relaxed text-[var(--faint)]">
          Score is the rail — every morning above is a cell in its canonical Whoop band; a second
          banded chart would say it twice.
        </p>
      </div>

      {/* 5 — the constant. */}
      <section className={`${PANEL} p-4`}>
        <div className={`mb-3 ${KICKER}`}>hrv · brushed window</div>
        <HrvPanel view={windowView(view, brushed)} height={170} verdict figure gauge axis />
      </section>

      {/* 6 — the variant's argument, and its bill. */}
      <section className={`${PANEL} p-4`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={KICKER}>resting hr · brushed window</span>
          <span
            className="rounded-[var(--radius-pill)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em]"
            style={{
              color: "var(--warning)",
              backgroundColor: "color-mix(in srgb, var(--warning) 13%, transparent)",
            }}
          >
            P2 · requires API work
          </span>
        </div>
        <p className="mt-1.5 text-[10px] tabular-nums text-[var(--faint)]">{boundsLine}</p>
        <div className="mt-3">
          <RestingRibbon points={proposedBrush} height={150} />
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-[var(--muted)]">
          the only variant that draws all three metrics alike — and the only one whose selection
          commits an API SOW
        </p>
      </section>

      {/* 7 — the ledger: all stored history, 20 a page, following the brush. */}
      <section className={`${PANEL} px-4 py-3`}>
        <div className="flex items-center justify-between gap-3 pb-2">
          <span className={KICKER}>ledger · all stored mornings</span>
          <span className="text-[9px] text-[var(--faint)]">
            the pager and the brush are linked — brushing the rail turns to the page that holds it
          </span>
        </div>

        <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {pageRows.length === 0 && (
            <div className="py-3 text-[11px] text-[var(--faint)]">no mornings recorded yet</div>
          )}
          {pageRows.map((r) => {
            const band = recoveryBand(r.recoveryScore);
            const inBrush = r.date >= firstBrushed && r.date <= lastBrushed;
            return (
              <div
                key={r.date}
                className="flex h-[26px] items-center gap-3 pl-2 text-[12px] tabular-nums"
                style={{
                  boxShadow: inBrush ? "inset 2px 0 0 0 var(--accent-line)" : undefined,
                }}
              >
                <span className="w-[104px] shrink-0 text-[var(--muted)]">{longDate(r.date)}</span>
                <span
                  className="w-[42px] shrink-0 rounded-[4px] px-1 text-center text-[11px] font-semibold"
                  style={{
                    color: recoveryBandColor(band),
                    backgroundColor:
                      band === "none"
                        ? "transparent"
                        : `color-mix(in srgb, ${recoveryBandColor(band)} 13%, transparent)`,
                  }}
                >
                  {round(r.recoveryScore)}
                </span>
                <span className="w-[70px] shrink-0 text-[var(--foreground)]">
                  {round(r.restingHr)}
                  <span className="ml-1 text-[10px] text-[var(--faint)]">bpm</span>
                </span>
                <span className="w-[70px] shrink-0 text-[var(--foreground)]">
                  {round(r.hrv)}
                  <span className="ml-1 text-[10px] text-[var(--faint)]">ms</span>
                </span>
                <span className="ml-auto text-[10px] text-[var(--faint)]">
                  {recoveryBandWord(band)}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-3 pt-3">
          <span className="text-xs tabular-nums text-[var(--muted)]">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium hover:border-[var(--accent)] disabled:opacity-40"
              disabled={page <= 1}
              onClick={() => setNudge(clamp(page - 1, 1, totalPages))}
            >
              Prev
            </button>
            <button
              type="button"
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium hover:border-[var(--accent)] disabled:opacity-40"
              disabled={page >= totalPages}
              onClick={() => setNudge(clamp(page + 1, 1, totalPages))}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {/* 8 */}
      <div className="flex justify-end pb-2">
        <Link
          href="/settings?tab=integrations"
          className="text-xs text-[var(--accent)] hover:underline"
        >
          Manage Whoop connection →
        </Link>
      </div>
    </div>
  );
}

// ── The rail's cells ──────────────────────────────────────────────────────────

/**
 * One stored morning. Three states, and they are deliberately different KINDS
 * of mark rather than three shades: a banded morning is a full-height cell of
 * its Whoop colour, a morning Whoop never recorded is a hollow surface cell,
 * and a morning with readings but no score is a short muted stub — never a band
 * colour, because there is no band to claim, and never full height, because
 * that would read as a scored day.
 */
function RailCell({ day, dim }: { day: RecoveryDayPoint; dim: boolean }) {
  if (isMissingNight(day)) {
    return (
      <div
        className="min-w-0 flex-1 rounded-[1px] bg-[var(--surface-2)]"
        style={{ opacity: dim ? 0.35 : 0.6 }}
        title={`${shortDate(day.date)} · no reading`}
      />
    );
  }

  if (day.recoveryScore === null) {
    return (
      <div
        className="flex min-w-0 flex-1 items-end"
        style={{ opacity: dim ? 0.35 : 1 }}
        title={`${shortDate(day.date)} · no score`}
      >
        <div className="h-[9px] w-full rounded-[1px] bg-[var(--muted)]" style={{ opacity: 0.35 }} />
      </div>
    );
  }

  const band = recoveryBand(day.recoveryScore);
  return (
    <div
      className="min-w-0 flex-1 rounded-[1px]"
      style={{ backgroundColor: recoveryBandColor(band), opacity: dim ? 0.3 : 0.85 }}
      title={`${shortDate(day.date)} · ${Math.round(day.recoveryScore)} · ${recoveryBandWord(band)}`}
    />
  );
}

// ── P2's ribbon ───────────────────────────────────────────────────────────────

const DOT_R = 2.6;
const PAD = 8;

/** The HRV chart's mark grammar, unchanged: in band a circle, below band an
 *  apex-down triangle, above band a diamond. Colour from `hrvStatusColor`. */
function RhrMark({
  x,
  y,
  r,
  status,
}: {
  x: number;
  y: number;
  r: number;
  status: RecoveryHrvStatus;
}) {
  const paint = {
    fill: hrvStatusColor(status),
    fillOpacity: status === "unknown" ? 0.45 : 1,
    stroke: "var(--surface)",
    strokeWidth: 1,
  };
  const shape =
    status === "suppressed" ? (
      <polygon
        points={`${-r * 1.3},${-r * 0.78} ${r * 1.3},${-r * 0.78} 0,${r * 1.12}`}
        {...paint}
      />
    ) : status === "elevated" ? (
      <polygon points={`0,${-r * 1.25} ${r * 1.25},0 0,${r * 1.25} ${-r * 1.25},0`} {...paint} />
    ) : (
      <circle r={r} {...paint} />
    );
  return <g transform={`translate(${x} ${y})`}>{shape}</g>;
}

/** Contiguous runs of indices whose point passes `keep` — what breaks the band
 *  polygon and the rolling hairline over a gap instead of bridging it. */
function runs(points: ProposedRestingPoint[], keep: (p: ProposedRestingPoint) => boolean) {
  const out: number[][] = [];
  let current: number[] = [];
  points.forEach((p, i) => {
    if (keep(p)) {
      current.push(i);
      return;
    }
    if (current.length > 0) out.push(current);
    current = [];
  });
  if (current.length > 0) out.push(current);
  return out;
}

function RestingRibbon({ points, height }: { points: ProposedRestingPoint[]; height: number }) {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();
  const n = points.length;

  const values: (number | null)[] = [];
  for (const p of points) values.push(p.rhr, p.low, p.high, p.rolling);
  const domain = extent(values, 8);
  const x = (i: number) => PAD + (i / Math.max(1, n - 1)) * (width - PAD * 2);
  const y = yScale(domain, PAD, Math.max(1, height - PAD * 2));

  // At long brushes every morning would be a mark and the plot would silt up,
  // so past ~200 mornings only the out-of-band ones keep theirs.
  const dense = n > 200;

  return (
    <>
      <div ref={ref} style={{ height }}>
        {width > 0 && n > 0 && (
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="block"
            role="img"
            aria-label={`${n} mornings of resting heart rate against a proposed band`}
          >
            {runs(points, (p) => p.low !== null && p.high !== null).map((run) => {
              if (run.length < 2) return null;
              const top = run.map((i) => `${x(i)},${y(points[i].high ?? 0)}`);
              const bottom = run
                .slice()
                .reverse()
                .map((i) => `${x(i)},${y(points[i].low ?? 0)}`);
              return (
                <polygon
                  key={points[run[0]].date}
                  points={[...top, ...bottom].join(" ")}
                  fill="var(--surface-3)"
                  stroke="var(--border)"
                  strokeWidth={1}
                />
              );
            })}

            {runs(points, (p) => p.rolling !== null).map((run) =>
              run.length < 2 ? null : (
                <polyline
                  key={`r-${points[run[0]].date}`}
                  points={run.map((i) => `${x(i)},${y(points[i].rolling ?? 0)}`).join(" ")}
                  fill="none"
                  stroke="var(--muted)"
                  strokeOpacity={0.6}
                  strokeWidth={1.25}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ),
            )}

            {points.map((p, i) => {
              if (p.rhr === null) return null;
              if (dense && p.status !== "suppressed" && p.status !== "elevated" && i !== n - 1) {
                return null;
              }
              return (
                <RhrMark
                  key={p.date}
                  x={x(i)}
                  y={y(p.rhr)}
                  r={i === n - 1 ? DOT_R + 1.2 : DOT_R}
                  status={p.status}
                />
              );
            })}
          </svg>
        )}
      </div>
      {n > 0 && (
        <div className="mt-1 flex items-center justify-between text-[9px] uppercase tracking-[0.08em] text-[var(--faint)]">
          <span>{shortDate(points[0].date)}</span>
          {dense && <span>marks shown for out-of-band mornings only at this width</span>}
          <span className="text-[var(--muted)]">{shortDate(points[n - 1].date)}</span>
        </div>
      )}
    </>
  );
}
