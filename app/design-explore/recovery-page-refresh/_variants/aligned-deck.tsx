/**
 * `aligned-deck` — three charts, one time axis. THROWAWAY design exploration.
 *
 * Reference product: Apple Health / trading terminals — a vertical deck of
 * plots bound to one x-domain and one synchronised crosshair, so dragging
 * anywhere reads out the same morning in all three.
 *
 * Score treatment: a BANDED COLUMN CHART — one column per morning, filled with
 * its canonical Whoop band (`recoveryBandColor(recoveryBand(score))`), the two
 * zone boundaries (33 / 67) as dashed hairlines. A null score or a missing
 * night draws NOTHING, so a gap reads as a gap and never as a zero.
 *
 * RHR treatment: a DIVERGING BAR CHART around the trailing average the server
 * already sent (`baseline.restingHrAvg`) as the zero line — up in `--warning`
 * when above, down in `--muted` when below. No band is claimed, and when the
 * average is null (calibrating) no bars are drawn and the row says so.
 *
 * P2: not required.
 *
 * Distinct because: the type scale is uniform and small (10px labels, 11–12px
 * ledger figures, 16px crosshair readouts, 24px window figures, nothing
 * larger); the colour logic confines band colour to the score columns and the
 * ledger pill while resting HR stays monochrome-plus-`--warning` and the accent
 * is spent only on the crosshair rule, the active window segment, links and the
 * selected ledger row; and the spacing rhythm is strict — the three deck rows
 * are ONE instrument separated by hairlines only, `py-3` each, `gap-4` page
 * wide, with no editorial whitespace anywhere.
 */
"use client";

import { useState } from "react";
import type { MouseEvent, ReactNode } from "react";
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
  LEDGER_PAGE_SIZE,
  bandCounts,
  ledgerRows,
  longDate,
  mean,
  pageCount,
  pageOf,
  round,
  shortDate,
  tail,
  windowView,
} from "../_shared";

/** The deck's left gutter, and the panel's right padding. Both are pixel
 *  constants because the crosshair's index maths has to agree with the plots. */
const GUTTER = 132;
const PLOT_PAD = 16;

const HRV_HEIGHT = 170;
const SCORE_HEIGHT = 120;
const RHR_HEIGHT = 100;

/**
 * The inset every plot on the deck shares, in pixels.
 *
 * It is the HRV chart's own — that chart insets both axes by the radius of the
 * largest mark it draws, so today's dot is not half outside the SVG. The two
 * column plots have no marks and would happily start at zero, but a deck whose
 * whole argument is ONE AXIS cannot have three x-mappings: the crosshair has to
 * land on the same morning in all three rows, at both ends of the window, or
 * the idiom is a lie at the edges. So the columns are centred on the HRV
 * chart's positions rather than on their own slots.
 */
const PLOT_INSET = 4.6;

/** The shared mapping: morning `i` of `n`, in pixels across a plot of `width`. */
function xAt(i: number, n: number, width: number): number {
  if (n <= 1) return width / 2;
  return PLOT_INSET + (i / (n - 1)) * (width - PLOT_INSET * 2);
}

const WINDOWS = [
  { key: "30d", days: 30, label: "Last 30 days" },
  { key: "90d", days: 90, label: "Last 90 days" },
  { key: "1y", days: 365, label: "Last 12 months" },
] as const;

type WindowKey = (typeof WINDOWS)[number]["key"];

const LABEL = "text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--faint)]";

// ── The page ──────────────────────────────────────────────────────────────────

export function AlignedDeckVariant({ view }: { view: RecoveryView }) {
  const days = view.days ?? [];
  const [windowKey, setWindowKey] = useState<WindowKey>("90d");
  const [hover, setHover] = useState<number | null>(null);
  const [pageState, setPageState] = useState(4);

  const spec = WINDOWS.find((w) => w.key === windowKey) ?? WINDOWS[1];
  const windowDays = tail(days, spec.days);
  const n = windowDays.length;

  // One index, shared by all three rows. Clamped on read so switching to a
  // shorter window while hovering cannot point past the end of the array.
  const hoverIdx = hover === null || n === 0 ? null : Math.min(Math.max(0, hover), n - 1);
  const selected: RecoveryDayPoint | null =
    n === 0 ? null : (windowDays[hoverIdx ?? n - 1] ?? null);
  // A fraction rather than a percentage, so the rule can be positioned with the
  // same inset the plots use and land exactly on the morning at either end.
  const crosshair = hoverIdx === null ? null : n <= 1 ? 0.5 : hoverIdx / (n - 1);

  function onMove(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const plotWidth = rect.width - GUTTER - PLOT_PAD;
    if (n === 0 || plotWidth <= 0) return;
    if (n === 1) {
      setHover(0);
      return;
    }
    const x = event.clientX - rect.left - GUTTER;
    const idx = Math.round((x / plotWidth) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, idx)));
  }

  const scoreRead = readoutOf(windowDays, hoverIdx, (d) => d.recoveryScore);
  const rhrRead = readoutOf(windowDays, hoverIdx, (d) => d.restingHr);
  const hrvRead = readoutOf(windowDays, hoverIdx, (d) => d.hrv);
  const restingHrAvg = view.baseline?.restingHrAvg ?? null;
  const baselineWindow = view.baseline?.windowDays ?? MIN_BASELINE_DAYS;

  return (
    <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-4">
      {/* 1 — header + window control */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            Recovery
          </h1>
          <p className="mt-0.5 text-[11px] text-[var(--muted)]">
            Three metrics on one time axis ·{" "}
            <span className="font-mono tabular-nums">{days.length}</span> mornings stored
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--border)] bg-[var(--surface)] p-1">
          {WINDOWS.map((w) => {
            const active = w.key === windowKey;
            return (
              <button
                key={w.key}
                type="button"
                onClick={() => setWindowKey(w.key)}
                aria-pressed={active}
                className={`rounded-[var(--radius-pill)] px-3 py-1 text-[11px] font-semibold tabular-nums transition ${
                  active
                    ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {w.key}
              </button>
            );
          })}
        </div>
      </header>

      {/* 2 — hero: window orientation, never today */}
      <WindowStrip label={spec.label} windowDays={windowDays} />

      {/* 3 — the deck */}
      <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-2">
          <span className={LABEL}>Aligned deck · one axis</span>
          <span className="font-mono text-[11px] tabular-nums text-[var(--foreground)]">
            {selected === null ? "No days in window" : longDate(selected.date)}
          </span>
        </div>

        <div
          className="divide-y divide-[var(--border)]"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          <DeckRow
            name="HRV"
            figure={round(hrvRead.value)}
            unit="ms"
            when={whenLabel(hrvRead)}
            crosshair={crosshair}
          >
            <HrvPanel view={windowView(view, windowDays)} height={HRV_HEIGHT} verdict axis />
          </DeckRow>

          <DeckRow
            name="Recovery"
            figure={round(scoreRead.value)}
            unit="%"
            when={whenLabel(scoreRead)}
            tone={recoveryBandColor(recoveryBand(scoreRead.value))}
            crosshair={crosshair}
          >
            <ScorePlot days={windowDays} height={SCORE_HEIGHT} />
          </DeckRow>

          <DeckRow
            name="Resting HR"
            figure={round(rhrRead.value)}
            unit="bpm"
            when={whenLabel(rhrRead)}
            crosshair={restingHrAvg === null ? null : crosshair}
          >
            {restingHrAvg === null ? (
              <p className="py-4 text-[11px] text-[var(--faint)]">
                No trailing average yet — the diverging baseline appears once{" "}
                <span className="font-mono tabular-nums">{MIN_BASELINE_DAYS}</span> mornings are
                recorded. Nothing is drawn against a number that does not exist.
              </p>
            ) : (
              <RhrPlot
                days={windowDays}
                avg={restingHrAvg}
                windowDays={baselineWindow}
                height={RHR_HEIGHT}
              />
            )}
          </DeckRow>
        </div>
      </div>

      {/* 4 — the ledger, over ALL stored history */}
      <Ledger
        days={days}
        selectedDate={selected?.date ?? null}
        page={pageState}
        onPage={setPageState}
      />

      {/* 5 — the quiet backlink */}
      <div className="flex justify-end pb-2">
        <Link
          href="/settings?tab=integrations"
          className="text-[11px] text-[var(--accent)] transition hover:opacity-80"
        >
          Manage Whoop connection →
        </Link>
      </div>
    </div>
  );
}

// ── Hero: the quiet metric strip ──────────────────────────────────────────────

function WindowStrip({ label, windowDays }: { label: string; windowDays: RecoveryDayPoint[] }) {
  const counts = bandCounts(windowDays);
  const total = counts.green + counts.yellow + counts.red;
  const segments = [
    { key: "green", n: counts.green, color: "var(--success)" },
    { key: "yellow", n: counts.yellow, color: "var(--warning)" },
    { key: "red", n: counts.red, color: "var(--danger)" },
  ];

  return (
    <section className="border-y border-[var(--border)] py-4">
      <p className={`mb-3 ${LABEL}`}>{label} · window orientation</p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <WindowCell label="Score avg" unit="%" values={windowDays.map((d) => d.recoveryScore)} />
        <WindowCell label="Resting HR avg" unit="bpm" values={windowDays.map((d) => d.restingHr)} />
        <WindowCell label="HRV avg" unit="ms" values={windowDays.map((d) => d.hrv)} />
        <div>
          <div className="flex h-[24px] items-center">
            <div className="flex h-[8px] w-full overflow-hidden rounded-[2px] bg-[var(--surface-2)]">
              {total > 0 &&
                segments.map((s) => (
                  <span
                    key={s.key}
                    style={{
                      width: `${(s.n / total) * 100}%`,
                      backgroundColor: s.color,
                      opacity: 0.85,
                    }}
                  />
                ))}
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-1 font-mono text-[11px] tabular-nums">
            {total === 0 ? (
              <span className="text-[var(--faint)]">no scored mornings</span>
            ) : (
              segments.map((s, i) => (
                <span key={s.key} style={{ color: s.color }}>
                  {i > 0 && <span className="pr-1 text-[var(--faint)]">·</span>}
                  {s.n}
                </span>
              ))
            )}
          </div>
          <div className={`mt-1 ${LABEL}`}>Band mix</div>
        </div>
      </div>
    </section>
  );
}

/** One window figure. Guarded: under `MIN_BASELINE_DAYS` readings it prints an
 *  honest count rather than a confident average (the calibrating state). */
function WindowCell({
  label,
  unit,
  values,
}: {
  label: string;
  unit: string;
  values: (number | null)[];
}) {
  const present = values.filter((v): v is number => v !== null);
  const enough = present.length >= MIN_BASELINE_DAYS;
  return (
    <div>
      <div className="flex h-[24px] items-baseline gap-1">
        <span className="text-[24px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-[var(--foreground)]">
          {enough ? round(mean(values)) : "—"}
        </span>
        <span className="text-[10px] text-[var(--muted)]">{enough ? unit : "not yet"}</span>
      </div>
      <div className="mt-1 font-mono text-[11px] tabular-nums text-[var(--faint)]">
        {enough ? (
          <>{present.length} nights</>
        ) : (
          <>
            {present.length} of {MIN_BASELINE_DAYS} nights
          </>
        )}
      </div>
      <div className={`mt-1 ${LABEL}`}>{label}</div>
    </div>
  );
}

// ── The deck ──────────────────────────────────────────────────────────────────

function DeckRow({
  name,
  figure,
  unit,
  when,
  tone,
  crosshair,
  children,
}: {
  name: string;
  figure: string;
  unit: string;
  when: string;
  tone?: string;
  crosshair: number | null;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[132px_minmax(0,1fr)] py-3">
      <div className="flex flex-col gap-1.5 pr-3 pl-4">
        <span className={LABEL}>{name}</span>
        <div className="flex items-baseline gap-1">
          <span
            className="font-mono text-[16px] leading-none font-semibold tabular-nums"
            style={{ color: tone ?? "var(--foreground)" }}
          >
            {figure}
          </span>
          <span className="text-[10px] text-[var(--muted)]">{unit}</span>
        </div>
        <span className="text-[9px] tracking-[0.08em] uppercase text-[var(--faint)]">{when}</span>
      </div>
      <div className="pr-4">
        <div className="relative">
          {children}
          {crosshair !== null && (
            <span
              className="pointer-events-none absolute inset-y-0 w-px bg-[var(--accent-line)]"
              style={{
                left: `calc(${PLOT_INSET}px + ${crosshair} * (100% - ${PLOT_INSET * 2}px))`,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** Score: a banded column chart. A gap is a gap — never a zero-height stub. */
function ScorePlot({ days, height }: { days: RecoveryDayPoint[]; height: number }) {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();
  const n = days.length;
  const step = n > 1 ? (width - PLOT_INSET * 2) / (n - 1) : width;
  const colW = Math.max(1, step - 1);
  const y = (v: number) => height - (Math.min(100, Math.max(0, v)) / 100) * height;

  return (
    <div ref={ref} style={{ height }}>
      {width > 0 && n > 0 && (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block"
          role="img"
          aria-label={`${n} mornings of recovery score, coloured by Whoop's canonical bands`}
        >
          {[33, 67].map((b) => (
            <line
              key={b}
              x1={0}
              x2={width}
              y1={y(b)}
              y2={y(b)}
              stroke="var(--border-strong)"
              strokeDasharray="2 3"
              strokeWidth={1}
            />
          ))}
          {days.map((d, i) => {
            if (d.recoveryScore === null) return null;
            const top = y(d.recoveryScore);
            return (
              <rect
                key={d.date}
                x={xAt(i, n, width) - colW / 2}
                y={top}
                width={colW}
                height={Math.max(1, height - top)}
                fill={recoveryBandColor(recoveryBand(d.recoveryScore))}
                opacity={0.85}
              />
            );
          })}
          {[33, 67].map((b) => (
            <text
              key={`tick-${b}`}
              x={width - 2}
              y={y(b) - 3}
              textAnchor="end"
              className="fill-[var(--faint)] font-mono text-[9px] tabular-nums"
            >
              {b}
            </text>
          ))}
        </svg>
      )}
    </div>
  );
}

/** Resting HR: bars diverging from the trailing average the server sent.
 *  The only arithmetic is `restingHr − restingHrAvg`, mapped onto a pixel. */
function RhrPlot({
  days,
  avg,
  windowDays,
  height,
}: {
  days: RecoveryDayPoint[];
  avg: number;
  windowDays: number;
  height: number;
}) {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();
  const n = days.length;
  const step = n > 1 ? (width - PLOT_INSET * 2) / (n - 1) : width;
  const colW = Math.max(1, step - 1);
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
            const above = dev > 0;
            const px = Math.max(1, (Math.abs(dev) / span) * half);
            return (
              <rect
                key={days[i].date}
                x={xAt(i, n, width) - colW / 2}
                y={above ? mid - px : mid}
                width={colW}
                height={px}
                fill={above ? "var(--warning)" : "var(--muted)"}
                opacity={above ? 0.85 : 0.7}
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

// ── The ledger, over ALL stored history ───────────────────────────────────────

function Ledger({
  days,
  selectedDate,
  page,
  onPage,
}: {
  days: RecoveryDayPoint[];
  selectedDate: string | null;
  page: number;
  onPage: (p: number) => void;
}) {
  const rows = ledgerRows(days);
  const totalPages = pageCount(rows.length);
  const current = Math.min(Math.max(1, page), totalPages);
  const pageRows = pageOf(rows, current);

  const selectedIndex = selectedDate === null ? -1 : rows.findIndex((r) => r.date === selectedDate);
  const selectedPage = selectedIndex < 0 ? null : Math.floor(selectedIndex / LEDGER_PAGE_SIZE) + 1;
  const elsewhere = selectedDate !== null && selectedPage !== null && selectedPage !== current;

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-2">
        <span className={LABEL}>Ledger · all stored history</span>
        <span className="font-mono text-[11px] tabular-nums text-[var(--faint)]">
          {rows.length} mornings
        </span>
      </div>

      <div className="grid grid-cols-[1fr_64px_56px_56px] border-b border-[var(--border)] px-4 py-1.5">
        <span className={LABEL}>Date</span>
        <span className={`text-right ${LABEL}`}>Score</span>
        <span className={`text-right ${LABEL}`}>bpm</span>
        <span className={`text-right ${LABEL}`}>ms</span>
      </div>

      <div className="divide-y divide-[var(--border)]">
        {pageRows.length === 0 && (
          <p className="px-4 py-4 text-[11px] text-[var(--faint)]">
            No mornings recorded yet — the ledger fills in one row per night.
          </p>
        )}
        {pageRows.map((r) => {
          const band = recoveryBand(r.recoveryScore);
          const color = recoveryBandColor(band);
          const isSelected = r.date === selectedDate;
          return (
            <div
              key={r.date}
              className={`relative grid h-[30px] grid-cols-[1fr_64px_56px_56px] items-center px-4 ${
                isSelected ? "bg-[var(--accent-soft)]" : ""
              }`}
            >
              {isSelected && (
                <span className="pointer-events-none absolute inset-y-0 left-0 w-[2px] bg-[var(--accent-line)]" />
              )}
              <span className="truncate text-[12px] text-[var(--foreground)]">
                {longDate(r.date)}
              </span>
              <span className="text-right">
                <span
                  className="inline-flex min-w-[36px] justify-center rounded-[var(--radius-pill)] px-1.5 py-0.5 font-mono text-[11px] tabular-nums"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
                    color,
                  }}
                  title={recoveryBandWord(band)}
                >
                  {round(r.recoveryScore)}
                </span>
              </span>
              <span className="text-right font-mono text-[12px] tabular-nums text-[var(--muted)]">
                {round(r.restingHr)}
              </span>
              <span className="text-right font-mono text-[12px] tabular-nums text-[var(--muted)]">
                {round(r.hrv)}
              </span>
            </div>
          );
        })}
      </div>

      {elsewhere && selectedPage !== null && selectedDate !== null && (
        <div className="border-t border-[var(--border)] px-4 py-1.5">
          <button
            type="button"
            onClick={() => onPage(selectedPage)}
            className="text-[11px] text-[var(--accent)] transition hover:opacity-80"
          >
            {shortDate(selectedDate)} is on page{" "}
            <span className="font-mono tabular-nums">{selectedPage}</span> →
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-2">
        <span className="font-mono text-[11px] tabular-nums text-[var(--faint)]">
          Page {current} of {totalPages}
        </span>
        <div className="flex items-center gap-1">
          <PagerButton label="Prev" disabled={current <= 1} onClick={() => onPage(current - 1)} />
          <PagerButton
            label="Next"
            disabled={current >= totalPages}
            onClick={() => onPage(current + 1)}
          />
        </div>
      </div>
    </div>
  );
}

function PagerButton({
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
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-[var(--border)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted)] transition hover:text-[var(--foreground)] disabled:cursor-default disabled:opacity-35 disabled:hover:text-[var(--muted)]"
    >
      {label}
    </button>
  );
}

// ── Readouts ──────────────────────────────────────────────────────────────────

type Readout = { value: number | null; date: string | null; hovered: boolean };

/** The hovered morning's value, or the most recent one that exists. Never a
 *  stale number pretending to be today — `whenLabel` always says which. */
function readoutOf(
  days: RecoveryDayPoint[],
  idx: number | null,
  get: (d: RecoveryDayPoint) => number | null,
): Readout {
  if (days.length === 0) return { value: null, date: null, hovered: false };
  if (idx !== null) {
    const d = days[idx];
    return { value: get(d), date: d.date, hovered: true };
  }
  for (let i = days.length - 1; i >= 0; i -= 1) {
    const v = get(days[i]);
    if (v !== null) return { value: v, date: days[i].date, hovered: false };
  }
  return { value: null, date: null, hovered: false };
}

function whenLabel(r: Readout): string {
  if (r.date === null) return "no reading";
  return r.hovered ? shortDate(r.date) : `latest · ${shortDate(r.date)}`;
}
