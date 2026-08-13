/**
 * `metric-focus` — one metric at a time, in full. THROWAWAY design exploration.
 *
 * Reference: Apple Health's single-metric detail + Oura's trends. Depth and
 * comparison are different jobs; the dashboard's five tiles already do
 * comparison, so this page does DEPTH — one metric owns the whole width, a real
 * y-axis, on-plot annotations and per-metric chrome that would be clutter if it
 * were tripled. The other two metrics collapse to austere strips that promote on
 * click, and the ledger's focused column is the one that carries ink.
 *
 * SCORE TREATMENT: a banded area — the score series drawn as gutterless vertical
 * slabs tinted by Whoop's canonical thirds, a hairline value line on top, the
 * band boundaries dashed on-plot with their words, and the window's distribution
 * stated as text in the margin beside the chart that shows it.
 *
 * RHR TREATMENT: the shipped `resting_hr` rank strip promoted to page scale
 * (order, not magnitude — sorted mornings, today's tick filled, the trailing
 * average dashed at its insert point), with a dated hairline line chart beneath
 * it. The rank answers *is this good for me?*; the line answers *what has it
 * been doing?*.
 *
 * P2: not required — deliberately; this variant's thesis is that resting HR
 * never needed a band.
 *
 * Distinct because it is the only variant where two of the three metrics are
 * deliberately almost silent: the page is a detail view, not a deck.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import type { RecoveryDayPoint, RecoveryView } from "@/lib/dashboard";
import { useMeasuredWidth } from "@/lib/use-measured-width";
import { HrvPanel } from "../_components/hrv-panel";
import {
  bandCounts,
  extent,
  isMissingNight,
  isMonthStart,
  ledgerRows,
  longDate,
  monthLabel,
  pageCount,
  pageOf,
  round,
  SCORE_ZONES,
  shortDate,
  tail,
  windowView,
  yScale,
} from "../_shared";
import {
  MIN_BASELINE_DAYS,
  ordinal,
  recoveryBand,
  recoveryBandColor,
  recoveryBandWord,
} from "@/app/(app)/dashboard/_components/recovery/shared";
import {
  avgInsertPct,
  endpointRow,
  labelAnchor,
  rankOf,
  sortedMornings,
  STRIP_WINDOW,
  tickPct,
} from "@/app/(app)/dashboard/_components/recovery/resting-strip";

/** The drawn window. Long enough that a season is visible, short enough that a
 *  slab per morning is still a slab. */
const WINDOW_DAYS = 90;
/** The mid-state the ledger opens at — Fixed Decision 4, never page one. */
const OPENING_PAGE = 4;
const PLOT_H = 300;
const LINE_H = 140;
const SPARK_H = 40;

type Metric = "score" | "rhr" | "hrv";

const METRICS: { key: Metric; name: string; unit: string }[] = [
  { key: "score", name: "Score", unit: "" },
  { key: "rhr", name: "Resting HR", unit: "bpm" },
  { key: "hrv", name: "HRV", unit: "ms" },
];

function seriesOf(days: RecoveryDayPoint[], metric: Metric): (number | null)[] {
  return days.map((d) =>
    metric === "score" ? d.recoveryScore : metric === "rhr" ? d.restingHr : d.hrv,
  );
}

function valueOf(day: RecoveryDayPoint | null, metric: Metric): number | null {
  if (!day) return null;
  return metric === "score" ? day.recoveryScore : metric === "rhr" ? day.restingHr : day.hrv;
}

// ── The page ──────────────────────────────────────────────────────────────────

export function MetricFocusVariant({ view }: { view: RecoveryView }) {
  const days = view.days ?? [];
  const rows = ledgerRows(days);
  const pages = pageCount(rows.length);

  const [metric, setMetric] = useState<Metric>("score");
  const [page, setPage] = useState(() => Math.min(OPENING_PAGE, pageCount(rows.length)));

  if (days.length === 0) {
    return (
      <div className="mx-auto w-full max-w-[980px] px-6 py-10">
        <p className="text-sm text-[var(--muted)]">No recovery history stored yet.</p>
      </div>
    );
  }

  const windowDaysDrawn = tail(days, WINDOW_DAYS);
  const today = days[days.length - 1];
  const recorded = days.filter((d) => !isMissingNight(d)).length;
  const baseline = view.baseline;
  const baselineWindow = baseline?.windowDays ?? 0;

  const figureFor = (m: Metric): number | null => {
    if (!baseline) return null;
    if (m === "score") return baseline.recoveryScoreAvg;
    if (m === "rhr") return baseline.restingHrAvg;
    return baseline.hrvAvg;
  };
  const samplesFor = (m: Metric): number => {
    if (!baseline) return 0;
    if (m === "score") return baseline.recoveryScoreDays;
    if (m === "rhr") return baseline.restingHrDays;
    return baseline.hrvDays;
  };

  const unitOf = (m: Metric) => METRICS.filter((x) => x.key === m)[0].unit;
  const nameOf = (m: Metric) => METRICS.filter((x) => x.key === m)[0].name;
  const unfocused = METRICS.filter((m) => m.key !== metric);

  const first = windowDaysDrawn[0];
  const last = windowDaysDrawn[windowDaysDrawn.length - 1];

  return (
    <div className="mx-auto flex w-full max-w-[980px] flex-col gap-10 px-6 py-10">
      {/* 1 — editorial header */}
      <header className="flex flex-col gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">
          Recovery · last {windowDaysDrawn.length} days
        </span>
        <h1 className="text-3xl font-semibold leading-none tracking-[-0.03em] text-[var(--foreground)]">
          Recovery
        </h1>
        <p className="max-w-[62ch] text-[13px] leading-relaxed text-[var(--muted)]">
          {shortDate(first.date)} to {shortDate(last.date)}, drawn one morning at a time ·{" "}
          <span className="tabular-nums">{recorded}</span> recorded mornings in store, all of them
          reachable in the record below.
        </p>
      </header>

      {/* 2 — the metric switcher */}
      <div className="flex items-center gap-4">
        <div className="inline-flex rounded-[var(--radius-pill)] border border-[var(--border)] bg-[var(--surface)] p-1">
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetric(m.key)}
              aria-pressed={m.key === metric}
              className={`rounded-[var(--radius-pill)] px-4 py-1.5 text-[12px] font-medium transition-colors ${
                m.key === metric
                  ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-[var(--faint)]">one metric, in full</span>
      </div>

      {/* 3 — the focused panel */}
      <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6">
        <Headline
          metric={metric}
          figure={figureFor(metric)}
          unit={unitOf(metric)}
          name={nameOf(metric)}
          baselineWindow={baselineWindow}
          samples={samplesFor(metric)}
          recorded={recorded}
          today={today}
        />

        <div className="mt-6">
          {metric === "score" && <ScoreFocus days={windowDaysDrawn} />}
          {metric === "rhr" && (
            <RestingFocus
              days={days}
              window={windowDaysDrawn}
              avg={baseline?.restingHrAvg ?? null}
            />
          )}
          {metric === "hrv" && (
            <HrvPanel
              view={windowView(view, tail(days, WINDOW_DAYS))}
              height={260}
              verdict
              figure
              gauge
              axis
              annotateRun
              boundsOnPlot
            />
          )}
        </div>
      </section>

      {/* 4 — the other two, collapsed */}
      <div className="flex flex-col gap-3">
        {unfocused.map((m) => (
          <CollapsedStrip
            key={m.key}
            name={m.name}
            unit={m.unit}
            figure={figureFor(m.key)}
            values={seriesOf(windowDaysDrawn, m.key)}
            fallback={recorded}
            onFocus={() => setMetric(m.key)}
          />
        ))}
      </div>

      {/* 5 — the ledger. The page is clamped on READ rather than trusted: the
          comparison route drives one mounted component across four fixtures,
          and the calibrating payload has no page 4 to be on. */}
      <Ledger
        rows={rows}
        page={Math.min(Math.max(1, page), pages)}
        pages={pages}
        onPage={setPage}
        metric={metric}
      />

      {/* 6 — the quiet backlink */}
      <footer className="flex justify-end">
        <Link
          href="/settings?tab=integrations"
          className="text-[12px] text-[var(--accent)] transition-colors hover:text-[var(--foreground)]"
        >
          Manage Whoop connection →
        </Link>
      </footer>
    </div>
  );
}

// ── The window-orientation headline ───────────────────────────────────────────

/**
 * Never today's number as the hero (Fixed Decision 1), and never an em-dash
 * where a number could be (Fixed Decision 5). When the server has not emitted an
 * average yet — the calibrating payload — the big figure becomes the honest
 * count of mornings behind the metric rather than a confident average invented
 * beside `HrvPanel`'s own calibrating state.
 */
function Headline({
  metric,
  figure,
  unit,
  name,
  baselineWindow,
  samples,
  recorded,
  today,
}: {
  metric: Metric;
  figure: number | null;
  unit: string;
  name: string;
  baselineWindow: number;
  samples: number;
  recorded: number;
  today: RecoveryDayPoint;
}) {
  const calibrating = figure === null;
  const big = calibrating ? recorded : Math.round(figure);
  const label = calibrating
    ? `${name} · mornings recorded · no average yet`
    : `${baselineWindow}-day average ${name.toLowerCase()}`;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <span className="text-[48px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-[var(--foreground)]">
          {big}
        </span>
        {!calibrating && unit !== "" && (
          <span className="text-[13px] font-medium text-[var(--muted)]">{unit}</span>
        )}
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--faint)]">
        {label}
      </span>
      <p className="mt-1 text-[13px] text-[var(--muted)]">
        <TodayReading metric={metric} today={today} unit={unit} />
        {calibrating && (
          <span className="text-[var(--faint)]">
            {" "}
            · <span className="tabular-nums">{samples}</span> of {MIN_BASELINE_DAYS} mornings behind
            this metric
          </span>
        )}
      </p>
    </div>
  );
}

/** Today in a quiet register — a footnote to the window, not the page's centre. */
function TodayReading({
  metric,
  today,
  unit,
}: {
  metric: Metric;
  today: RecoveryDayPoint;
  unit: string;
}) {
  const value = valueOf(today, metric);
  if (value === null) return <span>today hasn’t landed yet</span>;
  if (metric === "score") {
    const band = recoveryBand(value);
    return (
      <span>
        today <span className="tabular-nums text-[var(--foreground)]">{Math.round(value)}</span> ·{" "}
        <span style={{ color: recoveryBandColor(band) }}>{recoveryBandWord(band)}</span>
      </span>
    );
  }
  return (
    <span>
      today <span className="tabular-nums text-[var(--foreground)]">{Math.round(value)}</span>{" "}
      {unit}
    </span>
  );
}

// ── Score: a banded area, and its distribution as text ────────────────────────

function ScoreFocus({ days }: { days: RecoveryDayPoint[] }) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
      <div className="min-w-0 flex-1">
        <BandedArea days={days} />
      </div>
      <div className="w-full shrink-0 lg:w-[150px]">
        <BandDistribution days={days} />
      </div>
    </div>
  );
}

/**
 * One gutterless slab per morning, tinted by the band the score is in, with a
 * hairline value line on top. A null score — or a morning Whoop never recorded —
 * is a GAP in both, never a zero.
 */
function BandedArea({ days }: { days: RecoveryDayPoint[] }) {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();
  const n = days.length;
  const y = yScale([0, 100], 10, PLOT_H - 10);
  const step = n > 0 ? width / n : 0;
  const cx = (i: number) => i * step + step / 2;

  // Contiguous runs of scored mornings — the line breaks wherever the slabs do.
  const runs: { i: number; v: number }[][] = [];
  let run: { i: number; v: number }[] = [];
  days.forEach((d, i) => {
    if (d.recoveryScore === null) {
      if (run.length > 0) runs.push(run);
      run = [];
      return;
    }
    run.push({ i, v: d.recoveryScore });
  });
  if (run.length > 0) runs.push(run);

  const ticks = days.flatMap((d, i) =>
    i > 0 && isMonthStart(d.date) ? [{ i, label: monthLabel(d.date) }] : [],
  );

  return (
    <div>
      <div ref={ref} style={{ height: PLOT_H }}>
        {width > 0 && (
          <svg
            width={width}
            height={PLOT_H}
            viewBox={`0 0 ${width} ${PLOT_H}`}
            className="block"
            role="img"
            aria-label={`${n} mornings of recovery score, each filled in its Whoop band`}
          >
            {days.map((d, i) =>
              d.recoveryScore === null ? null : (
                <rect
                  key={d.date}
                  x={cx(i) - step / 2}
                  y={y(d.recoveryScore)}
                  width={step}
                  height={PLOT_H - y(d.recoveryScore)}
                  fill={recoveryBandColor(recoveryBand(d.recoveryScore))}
                  opacity={0.22}
                />
              ),
            )}
            {[33, 67].map((b) => (
              <line
                key={b}
                x1={0}
                x2={width}
                y1={y(b)}
                y2={y(b)}
                stroke="var(--border-strong)"
                strokeWidth={1}
                strokeDasharray="3 5"
              />
            ))}
            {runs.map((r) => (
              <polyline
                key={days[r[0].i].date}
                points={r.map(({ i, v }) => `${cx(i)},${y(v)}`).join(" ")}
                fill="none"
                stroke="var(--foreground)"
                strokeOpacity={0.5}
                strokeWidth={1.25}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {SCORE_ZONES.map((zone) => (
              <text
                key={zone.key}
                x={width - 6}
                y={y((zone.from + zone.to) / 2) + 3}
                textAnchor="end"
                fill={zone.color}
                className="text-[9px] uppercase tracking-[0.14em]"
              >
                {zone.word}
              </text>
            ))}
          </svg>
        )}
      </div>
      <div className="relative mt-1 h-[12px] text-[9px] uppercase tracking-[0.08em] text-[var(--faint)]">
        <span className="absolute left-0">{shortDate(days[0].date)}</span>
        {ticks.map((t) => (
          <span key={t.i} className="absolute" style={{ left: `${(t.i / Math.max(1, n)) * 100}%` }}>
            {t.label}
          </span>
        ))}
        <span className="absolute right-0 text-[var(--muted)]">{shortDate(days[n - 1].date)}</span>
      </div>
      <p className="mt-3 text-[11px] text-[var(--faint)]">
        Whoop’s own thirds, drawn rather than described — a rough fortnight is a stretch of colour.
      </p>
    </div>
  );
}

/** The distribution stated as text, beside the chart that shows it. */
function BandDistribution({ days }: { days: RecoveryDayPoint[] }) {
  const counts = bandCounts(days);
  const total = counts.green + counts.yellow + counts.red;
  const rows = [
    { band: "green" as const, count: counts.green },
    { band: "yellow" as const, count: counts.yellow },
    { band: "red" as const, count: counts.red },
  ];

  return (
    <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--faint)]">
        This window
      </span>
      {total === 0 ? (
        <p className="text-[11px] text-[var(--faint)]">No scored mornings in this window yet.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {rows.map((r) => (
            <div key={r.band} className="flex items-baseline gap-2">
              <span
                className="h-[8px] w-[8px] shrink-0 translate-y-[-1px] rounded-[2px]"
                style={{ backgroundColor: recoveryBandColor(r.band), opacity: 0.85 }}
              />
              <span className="flex-1 text-[12px] text-[var(--muted)]">
                {recoveryBandWord(r.band)}
              </span>
              <span className="text-[13px] tabular-nums text-[var(--foreground)]">{r.count}</span>
              <span className="w-[34px] text-right text-[11px] tabular-nums text-[var(--faint)]">
                {Math.round((r.count / total) * 100)}%
              </span>
            </div>
          ))}
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--faint)]">
            <span className="tabular-nums">{total}</span> scored mornings of{" "}
            <span className="tabular-nums">{days.length}</span> in the window.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Resting HR: the rank strip at page scale, plus a dated line ───────────────

function RestingFocus({
  days,
  window,
  avg,
}: {
  days: RecoveryDayPoint[];
  window: RecoveryDayPoint[];
  avg: number | null;
}) {
  const sorted = sortedMornings(days, STRIP_WINDOW);
  const todayValue = days[days.length - 1].restingHr;
  const n = sorted.length;
  const rank = rankOf(sorted, todayValue);
  const avgPct = avgInsertPct(sorted, avg);
  const { avgLabelPct, showLowest, showHighest } = endpointRow(avgPct);
  const warm = todayValue !== null && avg !== null && Math.round(todayValue - avg) > 0;
  const todayPct = rank === null || n === 0 ? null : tickPct(rank - 1, n);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--faint)]">
          Where this morning sits · last {Math.min(STRIP_WINDOW, n) || STRIP_WINDOW} mornings,
          sorted low to high
        </span>
        {n === 0 ? (
          <p className="text-[12px] text-[var(--muted)]">
            No resting-heart-rate readings in the last {STRIP_WINDOW} mornings.
          </p>
        ) : (
          <>
            <div className="relative h-[14px]">
              {todayPct !== null && todayValue !== null && (
                <span
                  className="absolute bottom-0 whitespace-nowrap text-[11px] tabular-nums"
                  style={{
                    ...labelAnchor(todayPct),
                    color: warm ? "var(--warning)" : "var(--foreground)",
                  }}
                >
                  {Math.round(todayValue)} bpm
                </span>
              )}
            </div>
            <div className="relative h-[56px]">
              {sorted.map((value, i) => {
                const isToday = rank !== null && i === rank - 1;
                return (
                  <span
                    key={`${value}-${i}`}
                    aria-hidden="true"
                    className="absolute bottom-0"
                    style={{
                      left: `${tickPct(i, n)}%`,
                      transform: "translateX(-50%)",
                      width: isToday ? 2 : 1,
                      height: isToday ? "100%" : "62%",
                      backgroundColor: isToday
                        ? warm
                          ? "var(--warning)"
                          : "var(--foreground)"
                        : "var(--border-strong)",
                    }}
                  />
                );
              })}
              {avgPct !== null && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 h-full w-px"
                  style={{
                    left: `${avgPct}%`,
                    transform: "translateX(-50%)",
                    background:
                      "repeating-linear-gradient(to bottom, var(--muted) 0 2px, transparent 2px 4px)",
                  }}
                />
              )}
            </div>
            <div className="relative h-[13px] text-[10px] tabular-nums text-[var(--faint)]">
              {showLowest && <span className="absolute left-0">{sorted[0]} lowest</span>}
              {avgLabelPct !== null && avg !== null && (
                <span
                  className="absolute whitespace-nowrap text-[var(--muted)]"
                  style={{ left: `${avgLabelPct}%`, transform: "translateX(-50%)" }}
                >
                  {Math.round(avg)} avg
                </span>
              )}
              {showHighest && <span className="absolute right-0">{sorted[n - 1]} highest</span>}
            </div>
            <p className="mt-1 text-[13px] text-[var(--muted)]">
              <RankCaption sorted={sorted} rank={rank} today={todayValue} avg={avg} warm={warm} />
            </p>
            <p className="text-[11px] text-[var(--faint)]">
              Order, not magnitude — the ticks are spaced by rank, so this answers “is this a good
              morning, for me?”.
            </p>
          </>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-6">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--faint)]">
          And what it has been doing · {window.length} dated mornings
        </span>
        <RestingLine days={window} avg={avg} />
        <p className="text-[11px] text-[var(--faint)]">
          Dated, with a gap wherever the strap was off — the rank cannot say “and it has been
          climbing”; this can.
        </p>
      </div>
    </div>
  );
}

/** The shipped tile's voice, at page scale — and honest when today is absent. */
function RankCaption({
  sorted,
  rank,
  today,
  avg,
  warm,
}: {
  sorted: number[];
  rank: number | null;
  today: number | null;
  avg: number | null;
  warm: boolean;
}) {
  const n = sorted.length;
  if (rank === null || today === null) {
    return (
      <span>
        No reading yet today — your last <span className="tabular-nums">{n}</span> mornings ran{" "}
        <span className="tabular-nums">{sorted[0]}</span> to{" "}
        <span className="tabular-nums">{sorted[n - 1]}</span> bpm
        {avg === null ? "" : ", averaging "}
        {avg === null ? "" : <span className="tabular-nums">{Math.round(avg)}</span>}
        {avg === null ? "" : " bpm"}.
      </span>
    );
  }
  const phrase = rank === n ? "highest" : rank === 1 ? "lowest" : `${ordinal(rank)} lowest`;
  return (
    <span>
      <span className="tabular-nums text-[var(--foreground)]">{Math.round(today)} bpm</span> —{" "}
      <span style={{ color: warm ? "var(--warning)" : "var(--foreground)" }}>{phrase}</span> of your
      last <span className="tabular-nums">{n}</span> mornings
    </span>
  );
}

function RestingLine({ days, avg }: { days: RecoveryDayPoint[]; avg: number | null }) {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();
  const n = days.length;
  const values = days.map((d) => d.restingHr);
  const domain = extent(avg === null ? values : [...values, avg], 6);
  const y = yScale(domain, 8, LINE_H - 16);
  const x = (i: number) => (i / Math.max(1, n - 1)) * width;

  const runs: { i: number; v: number }[][] = [];
  let run: { i: number; v: number }[] = [];
  values.forEach((v, i) => {
    if (v === null) {
      if (run.length > 0) runs.push(run);
      run = [];
      return;
    }
    run.push({ i, v });
  });
  if (run.length > 0) runs.push(run);

  const ticks = days.flatMap((d, i) =>
    i > 0 && isMonthStart(d.date) ? [{ i, label: monthLabel(d.date) }] : [],
  );

  return (
    <div>
      <div ref={ref} style={{ height: LINE_H }}>
        {width > 0 && (
          <svg
            width={width}
            height={LINE_H}
            viewBox={`0 0 ${width} ${LINE_H}`}
            className="block"
            role="img"
            aria-label={`${n} dated mornings of resting heart rate`}
          >
            {avg !== null && (
              <>
                <line
                  x1={0}
                  x2={width}
                  y1={y(avg)}
                  y2={y(avg)}
                  stroke="var(--muted)"
                  strokeWidth={1}
                  strokeDasharray="3 4"
                  strokeOpacity={0.7}
                />
                <text
                  x={width - 4}
                  y={y(avg) - 5}
                  textAnchor="end"
                  fill="var(--faint)"
                  className="text-[9px] tabular-nums"
                >
                  {Math.round(avg)} bpm avg
                </text>
              </>
            )}
            {runs.map((r) =>
              r.length < 2 ? (
                <circle
                  key={days[r[0].i].date}
                  cx={x(r[0].i)}
                  cy={y(r[0].v)}
                  r={1.4}
                  fill="var(--foreground)"
                  fillOpacity={0.7}
                />
              ) : (
                <polyline
                  key={days[r[0].i].date}
                  points={r.map(({ i, v }) => `${x(i)},${y(v)}`).join(" ")}
                  fill="none"
                  stroke="var(--foreground)"
                  strokeOpacity={0.7}
                  strokeWidth={1.25}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ),
            )}
          </svg>
        )}
      </div>
      <div className="relative mt-1 h-[12px] text-[9px] uppercase tracking-[0.08em] text-[var(--faint)]">
        <span className="absolute left-0">{shortDate(days[0].date)}</span>
        {ticks.map((t) => (
          <span
            key={t.i}
            className="absolute"
            style={{ left: `${(t.i / Math.max(1, n - 1)) * 100}%` }}
          >
            {t.label}
          </span>
        ))}
        <span className="absolute right-0 text-[var(--muted)]">{shortDate(days[n - 1].date)}</span>
      </div>
    </div>
  );
}

// ── The two metrics out of focus ──────────────────────────────────────────────

/** Deliberately austere: a metric out of focus should say almost nothing. */
function CollapsedStrip({
  name,
  unit,
  figure,
  fallback,
  values,
  onFocus,
}: {
  name: string;
  unit: string;
  figure: number | null;
  /** Mornings recorded — what a strip prints instead of an em-dash while the
   *  server is still calibrating and has no average to hand it. */
  fallback: number;
  values: (number | null)[];
  onFocus: () => void;
}) {
  const shownUnit = figure === null ? "mornings" : unit;
  return (
    <button
      type="button"
      onClick={onFocus}
      className="group flex h-[64px] w-full items-center gap-6 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-5 text-left transition-colors hover:bg-[var(--surface-2)]"
    >
      <span className="w-[92px] shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--faint)]">
        {name}
      </span>
      <span className="w-[100px] shrink-0 text-[16px] tabular-nums tracking-[-0.02em] text-[var(--foreground)]">
        {figure === null ? fallback : Math.round(figure)}
        {shownUnit !== "" && (
          <span className="ml-1 text-[10px] text-[var(--faint)]">{shownUnit}</span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <Spark values={values} />
      </span>
      <span className="shrink-0 text-[11px] text-[var(--accent)] opacity-70 transition-opacity group-hover:opacity-100">
        ↗ focus
      </span>
    </button>
  );
}

/** Monochrome by design — no colour leaves the focused panel. */
function Spark({ values }: { values: (number | null)[] }) {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();
  const n = values.length;
  const domain = extent(values, 4);
  const y = yScale(domain, 3, SPARK_H - 6);
  const x = (i: number) => (i / Math.max(1, n - 1)) * width;

  const runs: { i: number; v: number }[][] = [];
  let run: { i: number; v: number }[] = [];
  values.forEach((v, i) => {
    if (v === null) {
      if (run.length > 0) runs.push(run);
      run = [];
      return;
    }
    run.push({ i, v });
  });
  if (run.length > 0) runs.push(run);

  return (
    <div ref={ref} style={{ height: SPARK_H }}>
      {width > 0 && (
        <svg width={width} height={SPARK_H} viewBox={`0 0 ${width} ${SPARK_H}`} className="block">
          {runs.map((r) =>
            r.length < 2 ? null : (
              <polyline
                key={r[0].i}
                points={r.map(({ i, v }) => `${x(i)},${y(v)}`).join(" ")}
                fill="none"
                stroke="var(--faint)"
                strokeWidth={1}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ),
          )}
        </svg>
      )}
    </div>
  );
}

// ── The ledger ────────────────────────────────────────────────────────────────

function Ledger({
  rows,
  page,
  pages,
  onPage,
  metric,
}: {
  rows: RecoveryDayPoint[];
  page: number;
  pages: number;
  onPage: (p: number) => void;
  metric: Metric;
}) {
  const shown = pageOf(rows, page);
  const cell = (focused: boolean) =>
    `px-2 py-1.5 text-right text-[12px] tabular-nums ${
      focused ? "bg-[var(--surface-2)] text-[var(--foreground)]" : "text-[var(--faint)]"
    }`;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--faint)]">
          The record · every stored morning
        </span>
        <span className="text-[11px] text-[var(--faint)]">the focused column carries the ink</span>
      </div>

      <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]">
        <div className="grid grid-cols-[1fr_84px_84px_84px] border-b border-[var(--border)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]">
          <span className="text-[var(--faint)]">Date</span>
          <span className={cell(metric === "score")}>Score</span>
          <span className={cell(metric === "rhr")}>bpm</span>
          <span className={cell(metric === "hrv")}>ms</span>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {shown.map((day) => (
            <div key={day.date} className="grid grid-cols-[1fr_84px_84px_84px] px-4">
              <span className="py-1.5 text-[12px] text-[var(--muted)]">{longDate(day.date)}</span>
              <span className={cell(metric === "score")}>{round(day.recoveryScore)}</span>
              <span className={cell(metric === "rhr")}>{round(day.restingHr)}</span>
              <span className={cell(metric === "hrv")}>{round(day.hrv)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end gap-4 text-[11px]">
        <span className="tabular-nums text-[var(--faint)]">
          Page {page} of {pages}
        </span>
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(Math.max(1, page - 1))}
          className="text-[var(--muted)] transition-colors hover:text-[var(--foreground)] disabled:opacity-30 disabled:hover:text-[var(--muted)]"
        >
          ← Newer
        </button>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onPage(Math.min(pages, page + 1))}
          className="text-[var(--muted)] transition-colors hover:text-[var(--foreground)] disabled:opacity-30 disabled:hover:text-[var(--muted)]"
        >
          Older →
        </button>
      </div>
    </section>
  );
}
