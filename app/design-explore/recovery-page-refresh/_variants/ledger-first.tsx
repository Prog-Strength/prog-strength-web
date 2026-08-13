/**
 * `ledger-first` — the record IS the page. THROWAWAY design exploration.
 *
 * Reference products: Garmin Connect's metric-history tables (tight rows,
 * aligned numerals, paging that assumes years of data) and Linear's two-pane
 * density (a working surface, one accent, no editorial whitespace). The
 * paginated ledger is the PRIMARY COLUMN, permanently visible; the charts live
 * in a detail panel beside it and serve the row that is selected.
 *
 * Score treatment: THE LEDGER CELL IS THE CHART. Each row's score cell is a
 * 120px track filled to the score and tinted with its canonical Whoop band at
 * 22%, with a 2px band-coloured leading edge and the figure printed at the
 * edge. Scanning the column top-to-bottom IS reading a horizontal bar chart of
 * the month. A null score prints an em-dash and no bar — never a zero-width
 * bar. The panel header carries a compact banded column strip (±21 days) as the
 * same record in miniature.
 *
 * RHR treatment: A COLUMN OF MICRO-SPARKLINES — one 52×16 hand-rolled SVG per
 * row showing that morning against the trailing seven, warm when the morning
 * sits above the trailing average the SERVER sent (`baseline.restingHrAvg`),
 * monochrome otherwise. In the detail panel, the same diverging-bar strip
 * `aligned-deck` uses, deliberately: the ledger answers "how did this land",
 * the panel answers "how far off normal was it".
 *
 * P2: not required. No resting-HR band is claimed anywhere — the only RHR
 * arithmetic is `restingHr − baseline.restingHrAvg`, a server figure mapped
 * onto a pixel.
 *
 * Distinct because: it is the only variant with no full-width chart at all, the
 * only one whose default selection is a MID-HISTORY morning rather than today,
 * and the only one where band colour lives inside the table cells rather than
 * on a plot — the type scale is dead flat (10px labels, 12px figures, one 20px
 * date, 18px metric values, nothing larger) and the rhythm is a strict 30px row.
 */
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import type { RecoveryDayPoint, RecoveryView } from "@/lib/dashboard";
import { useMeasuredWidth } from "@/lib/use-measured-width";
import {
  MIN_BASELINE_DAYS,
  recoveryBand,
  recoveryBandColor,
  recoveryBandWord,
} from "@/app/(app)/dashboard/_components/recovery/shared";
import { HrvPanel } from "../_components/hrv-panel";
import {
  ledgerRows,
  longDate,
  monthYear,
  norm,
  pageCount,
  pageOf,
  parseISO,
  round,
  shortDate,
  signed,
  weekdayOf,
  windowView,
} from "../_shared";

/** The mid-state page the ticket asks every variant to open on. Clamped. */
const OPEN_PAGE = 4;
/** Where in that page the default selection sits — mid-history, not today. */
const OPEN_ROW = 10;

/** The ledger's score track. Fixed so the column reads as one bar chart. */
const TRACK_W = 120;
/** The per-row resting-HR sparkline. */
const SPARK_W = 52;
const SPARK_H = 16;
const SPARK_DAYS = 7;
/** How much history the panel's HRV window and diverging strip cover. */
const PANEL_WINDOW = 45;
/** Half-width of the panel header's banded column strip. */
const STRIP_HALF = 21;

/** "11 Jun 2025" — the record's span needs the year the ledger's rows omit. */
function spanDate(iso: string): string {
  return `${shortDate(iso)} ${parseISO(iso).getFullYear()}`;
}

/** A band tint weak enough to sit under a 12px numeral on near-black. */
function bandTint(color: string): string {
  return `color-mix(in srgb, ${color} 22%, transparent)`;
}

export function LedgerFirstVariant({ view }: { view: RecoveryView }) {
  const days = useMemo(() => view.days ?? [], [view.days]);
  const rows = useMemo(() => ledgerRows(days), [days]);
  const indexByDate = useMemo(() => {
    const map = new Map<string, number>();
    days.forEach((d, i) => map.set(d.date, i));
    return map;
  }, [days]);

  const pages = pageCount(rows.length);
  const [page, setPage] = useState(Math.min(OPEN_PAGE, pages));
  const [picked, setPicked] = useState<string | null>(null);

  // Both the page and the selection are clamped against the CURRENT history
  // rather than trusted: the comparison route drives one component across four
  // fixtures, and a calibrating view has neither a page 4 nor July's rows.
  const current = Math.min(Math.max(1, page), pages);
  const pageRows = pageOf(rows, current);

  const fallback = useMemo(() => {
    const openRows = pageOf(rows, Math.min(OPEN_PAGE, pageCount(rows.length)));
    const row = openRows[Math.min(OPEN_ROW, openRows.length - 1)] ?? rows[0];
    return row ? row.date : null;
  }, [rows]);

  const selectedDate = picked !== null && indexByDate.has(picked) ? picked : fallback;
  const selectedIndex = selectedDate === null ? -1 : (indexByDate.get(selectedDate) ?? -1);
  const selected = selectedIndex >= 0 ? days[selectedIndex] : null;

  const oldest = rows.length > 0 ? rows[rows.length - 1].date : null;
  const newest = rows.length > 0 ? rows[0].date : null;

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-xl font-semibold tracking-[-0.02em] text-[var(--foreground)]">
            Recovery
          </h1>
          {/* The window orientation for this variant is the RECORD ITSELF —
              a count and a span, stated whether or not today has landed. */}
          <p className="text-xs tabular-nums text-[var(--muted)]">
            {oldest && newest ? (
              <>
                {rows.length} mornings · {spanDate(oldest)} – {spanDate(newest)}
              </>
            ) : (
              "No mornings recorded yet"
            )}
          </p>
        </div>
        <Link
          href="/settings?tab=integrations"
          className="text-xs text-[var(--accent)] hover:underline"
        >
          Manage Whoop connection →
        </Link>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 lg:flex-[3]">
          <Ledger
            rows={pageRows}
            indexByDate={indexByDate}
            days={days}
            restingHrAvg={view.baseline?.restingHrAvg ?? null}
            selectedDate={selectedDate}
            onSelect={setPicked}
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs tabular-nums text-[var(--muted)]">
              Page {current} of {pages}
            </span>
            <div className="flex items-center gap-2">
              <PageButton
                label="Prev"
                disabled={current <= 1}
                onClick={() => setPage(current - 1)}
              />
              <PageButton
                label="Next"
                disabled={current >= pages}
                onClick={() => setPage(current + 1)}
              />
            </div>
          </div>
        </div>

        <div className="min-w-0 lg:sticky lg:top-4 lg:flex-[2]">
          <DetailPanel view={view} days={days} index={selectedIndex} day={selected} />
        </div>
      </div>
    </div>
  );
}

function PageButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:border-[var(--accent)] disabled:opacity-40"
    >
      {label}
    </button>
  );
}

// ── The ledger — the primary column ───────────────────────────────────────────

function Ledger({
  rows,
  days,
  indexByDate,
  restingHrAvg,
  selectedDate,
  onSelect,
}: {
  rows: RecoveryDayPoint[];
  days: RecoveryDayPoint[];
  indexByDate: Map<string, number>;
  restingHrAvg: number | null;
  selectedDate: string | null;
  onSelect: (date: string) => void;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]">
      {/* Sticky, so the heads survive a 20-row page on a short viewport. The
          row list keeps its own `overflow-hidden` for the bottom corners —
          putting it on this container would make the heads stick to nothing. */}
      <div className="sticky top-0 z-10 flex items-center gap-3 rounded-t-[var(--radius-card)] border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-[var(--faint)]">
        <span className="w-[92px] shrink-0">Date</span>
        <span className="shrink-0" style={{ width: TRACK_W }}>
          Score
        </span>
        <span className="w-[96px] shrink-0 text-right">Resting HR</span>
        <span className="ml-auto w-[52px] shrink-0 text-right">HRV</span>
      </div>

      {rows.length === 0 ? (
        <p className="px-3 py-4 text-xs text-[var(--muted)]">
          No mornings on this page — the record starts once Whoop has scored a night.
        </p>
      ) : (
        <div className="divide-y divide-[var(--border)] overflow-hidden rounded-b-[var(--radius-card)]">
          {rows.map((row, i) => {
            const prev = i === 0 ? null : rows[i - 1];
            const seam = prev === null || monthYear(prev.date) !== monthYear(row.date);
            const at = indexByDate.get(row.date) ?? -1;
            const trailing = at < 0 ? [] : days.slice(Math.max(0, at - (SPARK_DAYS - 1)), at + 1);
            return (
              <div key={row.date}>
                {seam && (
                  <div className="flex h-[20px] items-center bg-[var(--surface-2)] px-3 text-[10px] uppercase tracking-[0.1em] text-[var(--faint)]">
                    {monthYear(row.date)}
                  </div>
                )}
                <LedgerRow
                  day={row}
                  trailing={trailing}
                  restingHrAvg={restingHrAvg}
                  selected={row.date === selectedDate}
                  onSelect={onSelect}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LedgerRow({
  day,
  trailing,
  restingHrAvg,
  selected,
  onSelect,
}: {
  day: RecoveryDayPoint;
  trailing: RecoveryDayPoint[];
  restingHrAvg: number | null;
  selected: boolean;
  onSelect: (date: string) => void;
}) {
  const above = restingHrAvg !== null && day.restingHr !== null && day.restingHr > restingHrAvg;

  return (
    <button
      type="button"
      onClick={() => onSelect(day.date)}
      aria-current={selected ? "true" : undefined}
      className={`flex h-[30px] w-full items-center gap-3 border-l-2 px-3 text-left transition-colors ${
        selected
          ? "border-[var(--accent-line)] bg-[var(--accent-soft)]"
          : "border-transparent hover:bg-[var(--surface-2)]"
      }`}
    >
      <span className="flex w-[92px] shrink-0 items-baseline gap-1.5">
        <span className="w-[20px] text-[10px] uppercase tracking-[0.06em] text-[var(--faint)]">
          {weekdayOf(day.date)}
        </span>
        <span className="text-[12px] tabular-nums text-[var(--muted)]">{shortDate(day.date)}</span>
      </span>

      <ScoreCell score={day.recoveryScore} />

      <span className="flex w-[96px] shrink-0 items-center justify-end gap-2">
        <RhrSpark trailing={trailing} above={above} />
        <span
          className="w-[24px] text-right text-[12px] tabular-nums"
          style={{ color: above ? "var(--warning)" : "var(--foreground)" }}
        >
          {round(day.restingHr)}
        </span>
      </span>

      <span className="ml-auto w-[52px] shrink-0 text-right text-[12px] tabular-nums text-[var(--muted)]">
        {round(day.hrv)}
      </span>
    </button>
  );
}

/** The idiom's whole move: the cell is the bar. */
function ScoreCell({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <span
        className="shrink-0 text-center text-[12px] text-[var(--faint)]"
        style={{ width: TRACK_W }}
      >
        —
      </span>
    );
  }
  const pct = Math.min(100, Math.max(0, score));
  const color = recoveryBandColor(recoveryBand(score));
  // Past ~three quarters the numeral would run off the track, so it flips to
  // the inside of the leading edge rather than shrinking the track.
  const inside = pct >= 76;

  return (
    <span
      className="relative h-[16px] shrink-0 rounded-[2px] bg-[var(--surface-2)]"
      style={{ width: TRACK_W }}
    >
      <span
        className="absolute inset-y-0 left-0 rounded-l-[2px]"
        style={{ width: `${pct}%`, backgroundColor: bandTint(color) }}
      />
      <span
        className="absolute inset-y-0 w-[2px]"
        style={{ left: `${pct}%`, transform: "translateX(-2px)", backgroundColor: color }}
      />
      <span
        className={`absolute top-0 leading-[16px] text-[12px] tabular-nums ${
          inside ? "pr-1.5" : "pl-1.5"
        }`}
        style={{ left: `${pct}%`, transform: inside ? "translateX(-100%)" : "none", color }}
      >
        {score}
      </span>
    </span>
  );
}

/** This morning against the trailing seven — the only per-row chart small
 *  enough to live in a 30px row. Gaps where a night is missing. */
function RhrSpark({ trailing, above }: { trailing: RecoveryDayPoint[]; above: boolean }) {
  const values = trailing.map((d) => d.restingHr);
  const present = values.filter((v): v is number => v !== null);
  const last = values.length === 0 ? null : values[values.length - 1];
  // Nothing to plot: fewer than two readings behind this morning, or the
  // morning itself unrecorded. Reserve the box so the column stays aligned.
  if (present.length < 2 || last === null) {
    return <span className="inline-block" style={{ width: SPARK_W, height: SPARK_H }} />;
  }

  const lo = Math.min(...present);
  const hi = Math.max(...present);
  const n = values.length;
  const x = (i: number) => 2 + (i / Math.max(1, n - 1)) * (SPARK_W - 4);
  const y = (v: number) => SPARK_H - 3 - norm(v, lo, hi) * (SPARK_H - 6);

  // Contiguous runs only, so a strap-off night breaks the line instead of
  // bridging across it.
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
    <svg
      width={SPARK_W}
      height={SPARK_H}
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      className="block shrink-0"
      aria-hidden="true"
    >
      {runs.map((points) =>
        points.length < 2 ? null : (
          <polyline
            key={points[0].i}
            points={points.map((p) => `${x(p.i)},${y(p.v)}`).join(" ")}
            fill="none"
            stroke="var(--faint)"
            strokeWidth={1}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ),
      )}
      <circle
        cx={x(n - 1)}
        cy={y(last)}
        r={2}
        fill={above ? "var(--warning)" : "var(--foreground)"}
      />
    </svg>
  );
}

// ── The detail panel — driven by the selected row ─────────────────────────────

function DetailPanel({
  view,
  days,
  index,
  day,
}: {
  view: RecoveryView;
  days: RecoveryDayPoint[];
  index: number;
  day: RecoveryDayPoint | null;
}) {
  if (day === null || index < 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-3">
        <p className="text-xs text-[var(--muted)]">
          Select a morning in the record to see it against its own baseline.
        </p>
      </div>
    );
  }

  const baseline = view.baseline;
  const windowDays = baseline?.windowDays ?? 30;
  const strip = days.slice(Math.max(0, index - STRIP_HALF), index + STRIP_HALF + 1);
  const hrvWindow = days.slice(Math.max(0, index - (PANEL_WINDOW - 1)), index + 1);
  const scoreAvg = baseline?.recoveryScoreAvg ?? null;
  const rhrAvg = baseline?.restingHrAvg ?? null;
  const band = recoveryBand(day.recoveryScore);

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--faint)]">
            Selected morning
          </div>
          <div className="mt-1 text-[20px] leading-none tracking-[-0.02em] tabular-nums text-[var(--foreground)]">
            {longDate(day.date)} {parseISO(day.date).getFullYear()}
          </div>
        </div>
        <BandStrip days={strip} selectedDate={day.date} />
      </div>

      <div className="flex flex-col divide-y divide-[var(--border)] border-y border-[var(--border)]">
        <MetricRow
          label="Recovery score"
          value={day.recoveryScore}
          unit=""
          word={day.recoveryScore === null ? null : recoveryBandWord(band)}
          wordColor={recoveryBandColor(band)}
          delta={
            day.recoveryScore === null || scoreAvg === null ? null : day.recoveryScore - scoreAvg
          }
          note={
            scoreAvg === null
              ? `no ${windowDays}-day average yet`
              : `vs current ${windowDays}d avg ${round(scoreAvg)} · not a per-day baseline`
          }
        />
        <MetricRow
          label="Resting HR"
          value={day.restingHr}
          unit="bpm"
          word={null}
          wordColor="var(--muted)"
          delta={day.restingHr === null || rhrAvg === null ? null : day.restingHr - rhrAvg}
          warmWhenAbove
          note={
            rhrAvg === null
              ? `no ${windowDays}-day average yet`
              : `vs current ${windowDays}d avg ${round(rhrAvg)} bpm`
          }
        />
        <MetricRow
          label="HRV"
          value={day.hrv}
          unit="ms"
          word={null}
          wordColor="var(--muted)"
          delta={day.hrv === null || day.baselineAvg === null ? null : day.hrv - day.baselineAvg}
          note={
            day.baselineAvg === null
              ? "that morning's own band had not calibrated yet"
              : `vs THAT morning's own baseline ${round(day.baselineAvg)} ms — the only per-day baseline the payload carries`
          }
        />
      </div>

      <div>
        <div className="mb-1.5 text-[10px] uppercase tracking-[0.12em] text-[var(--faint)]">
          HRV · {hrvWindow.length} days to this morning
        </div>
        <HrvPanel view={windowView(view, hrvWindow)} height={120} verdict />
      </div>

      <div>
        <div className="mb-1.5 text-[10px] uppercase tracking-[0.12em] text-[var(--faint)]">
          Resting HR · {hrvWindow.length} days around the {windowDays}-day average
        </div>
        {rhrAvg === null ? (
          <p className="text-[11px] text-[var(--faint)]">
            <span className="tabular-nums text-[var(--muted)]">
              {baseline?.restingHrDays ?? 0} of {MIN_BASELINE_DAYS}
            </span>{" "}
            mornings · the diverging baseline appears once Whoop has enough of them
          </p>
        ) : (
          <RhrDiverging
            days={hrvWindow}
            avg={rhrAvg}
            windowDays={windowDays}
            selectedDate={day.date}
          />
        )}
      </div>
    </div>
  );
}

function MetricRow({
  label,
  value,
  unit,
  word,
  wordColor,
  delta,
  note,
  warmWhenAbove = false,
}: {
  label: string;
  value: number | null;
  unit: string;
  word: string | null;
  wordColor: string;
  delta: number | null;
  note: string;
  warmWhenAbove?: boolean;
}) {
  const warm = warmWhenAbove && delta !== null && delta > 0;
  return (
    <div className="flex items-end justify-between gap-3 py-2">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--faint)]">{label}</div>
        <div className="mt-0.5 flex items-baseline gap-1.5">
          <span className="text-[18px] leading-none tabular-nums text-[var(--foreground)]">
            {round(value)}
          </span>
          {unit !== "" && <span className="text-[11px] text-[var(--muted)]">{unit}</span>}
          {word !== null && (
            <span className="text-[11px] font-medium" style={{ color: wordColor }}>
              {word}
            </span>
          )}
        </div>
      </div>
      <div className="max-w-[58%] shrink-0 text-right">
        <div
          className="text-[12px] tabular-nums"
          style={{ color: warm ? "var(--warning)" : "var(--muted)" }}
        >
          {delta === null ? "—" : signed(delta)}
        </div>
        <div className="mt-0.5 text-[9px] leading-[1.25] text-[var(--faint)]">{note}</div>
      </div>
    </div>
  );
}

/** The panel's own miniature of the score record: ±21 days of band-coloured
 *  columns, the selected morning at full strength. */
function BandStrip({ days, selectedDate }: { days: RecoveryDayPoint[]; selectedDate: string }) {
  if (days.length === 0) return null;
  return (
    <div className="flex h-[34px] items-end gap-[2px]" aria-hidden="true">
      {days.map((d) => {
        const here = d.date === selectedDate;
        if (d.recoveryScore === null) {
          // A morning with no score is a hollow slot, never a zero column.
          return (
            <span
              key={d.date}
              className="w-[2px] bg-[var(--faint)]"
              style={{ height: 1, opacity: here ? 1 : 0.4 }}
            />
          );
        }
        const color = recoveryBandColor(recoveryBand(d.recoveryScore));
        return (
          <span
            key={d.date}
            className="w-[2px]"
            style={{
              height: Math.max(2, (d.recoveryScore / 100) * 34),
              backgroundColor: color,
              opacity: here ? 1 : 0.55,
              boxShadow: here ? "0 0 0 1px var(--foreground)" : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

/** Resting HR as bars diverging from the trailing average the server sent —
 *  deliberately the same treatment `aligned-deck` uses. The only arithmetic is
 *  `restingHr − restingHrAvg`, mapped onto a pixel. */
function RhrDiverging({
  days,
  avg,
  windowDays,
  selectedDate,
}: {
  days: RecoveryDayPoint[];
  avg: number;
  windowDays: number;
  selectedDate: string;
}) {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();
  const height = 64;
  const n = days.length;
  const slot = n > 0 && width > 0 ? width / n : 0;
  const colW = Math.max(1, slot - 1);
  const deviations = days.map((d) => (d.restingHr === null ? null : d.restingHr - avg));
  const present = deviations.filter((v): v is number => v !== null).map(Math.abs);
  const span = Math.max(4, ...present);
  const mid = height / 2;
  const half = Math.max(1, mid - 10);

  return (
    <div ref={ref} style={{ height }}>
      {width > 0 && n > 0 && (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block"
          role="img"
          aria-label={`${n} mornings of resting heart rate above and below the ${windowDays}-day average`}
        >
          {deviations.map((dev, i) => {
            if (dev === null) return null;
            const here = days[i].date === selectedDate;
            const above = dev > 0;
            const px = Math.max(1, (Math.abs(dev) / span) * half);
            return (
              <rect
                key={days[i].date}
                x={i * slot}
                y={above ? mid - px : mid}
                width={colW}
                height={px}
                fill={above ? "var(--warning)" : "var(--muted)"}
                opacity={here ? 1 : above ? 0.8 : 0.6}
                stroke={here ? "var(--foreground)" : undefined}
                strokeWidth={here ? 1 : undefined}
              />
            );
          })}
          <line x1={0} x2={width} y1={mid} y2={mid} stroke="var(--border-strong)" strokeWidth={1} />
          <text
            x={width - 2}
            y={mid - 5}
            textAnchor="end"
            className="fill-[var(--faint)] font-mono text-[9px] tabular-nums"
          >
            {windowDays}d avg {Math.round(avg)} bpm
          </text>
        </svg>
      )}
    </div>
  );
}
