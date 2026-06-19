"use client";

/**
 * VARIANT 1 / 5 — idiom: readiness-gauge
 * ----------------------------------------------------------------------------
 * The gap, made the hero. Each lift is a full-width horizontal TRACK: the
 * tested PR anchors the left, the current estimate is a marker pulled ahead of
 * it, and the LIT SEGMENT between them is the readiness. "Time for a max" stops
 * being a badge and becomes the gap visibly opening up — a bigger gapPct lights
 * more of the track, with the warning tone's intensity scaling on the segment.
 *
 *   Draws on : Whoop / Oura readiness bars — one quantified bar per metric,
 *              restrained color spent entirely on the meaningful segment.
 *   Type scale: medium; tabular figures, not huge — the gauge carries hierarchy.
 *   Color logic: neutral field; discipline steel-blue as the baseline fill;
 *              WARNING lives ONLY in the lit gap and scales with magnitude;
 *              success only on the numeric +gap. Accent stays app-chrome.
 *   Spacing  : roomy horizontal rows, generous vertical gutters between tracks.
 *
 * Throwaway DX mockup — static fixtures, no data wiring.
 */

import type { PersonalRecord } from "@/lib/api";
import {
  deriveReadiness,
  fmtAgo,
  fmtNum,
  fmtWeight,
  type Readiness,
  type RenderMode,
} from "../_fixtures";

// The track maps gapPct onto a fixed window so a small gap reads short and a
// large gap reads long. MAX_PCT caps the window; readiness past it pins full.
const MAX_PCT = 36;

export function ReadinessGauge({ records, mode }: { records: PersonalRecord[]; mode: RenderMode }) {
  const rows = records.map(deriveReadiness);
  return (
    <div className="flex flex-col">
      <Chrome />
      <div className="px-6 py-6">
        {mode === "error" ? (
          <ErrorState />
        ) : mode === "loading" ? (
          <LoadingState />
        ) : (
          <div className="flex flex-col divide-y divide-[var(--border)]">
            {rows.map((r) => (
              <GaugeRow key={r.record.exercise_id} r={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GaugeRow({ r }: { r: Readiness }) {
  if (!r.hasPR) {
    return (
      <div className="flex items-center justify-between gap-4 py-5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--muted)]">
            {r.record.exercise_name}
          </p>
          <p className="text-xs text-[var(--faint)]">No record yet</p>
        </div>
        <button className="shrink-0 rounded-full border border-[var(--border-strong)] px-3 py-1 text-xs text-[var(--muted)] transition hover:text-[var(--foreground)]">
          Test this lift →
        </button>
      </div>
    );
  }

  const pct = r.gapPct ?? 0;
  const frac = Math.max(0.02, Math.min(1, pct / MAX_PCT));
  // Intensity of the lit segment scales with readiness: fresh ≈ calm, large
  // gap ≈ full warning. Mapped onto opacity so it's the SAME hue, more lit.
  const intensity = Math.max(0, Math.min(1, pct / 30));
  const fresh = pct < 5; // freshly tested — "nothing to chase", and that's fine.

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 py-5 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center sm:gap-6">
      {/* Identity + PR */}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium tracking-tight" title={r.record.exercise_name}>
          {r.record.exercise_name}
        </p>
        <p className="mt-0.5 flex items-baseline gap-1.5">
          <span className="text-xl font-semibold tabular-nums tracking-tight">
            {fmtWeight(r.record.weight, r.record.unit)}
          </span>
          <span className="text-xs text-[var(--muted)] tabular-nums">× {r.record.reps}</span>
          {r.isDumbbell && <span className="text-[10px] text-[var(--faint)]">/ea</span>}
        </p>
        <p className="text-[11px] text-[var(--faint)]">{fmtAgo(r.daysSince)}</p>
      </div>

      {/* The gauge */}
      <div>
        <div className="relative h-9">
          {/* baseline track */}
          <div className="absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 overflow-hidden rounded-full bg-[var(--discipline-lift-bg)]">
            {/* lit readiness segment — warning, scaling by intensity */}
            <div
              className="h-full rounded-full"
              style={{
                width: `${frac * 100}%`,
                background: `color-mix(in srgb, var(--warning) ${30 + intensity * 70}%, transparent)`,
              }}
            />
          </div>
          {/* PR anchor (left tick) */}
          <div className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded bg-[var(--discipline-lift-dot)]" />
          {/* estimate marker, pulled ahead by the gap */}
          <div
            className="absolute top-1/2 -translate-y-1/2"
            style={{ left: `calc(${frac * 100}% - 6px)` }}
          >
            <div
              className="h-4 w-3 rounded-sm border border-[var(--background)]"
              style={{
                background: fresh ? "var(--discipline-lift-dot)" : "var(--warning)",
              }}
            />
          </div>
        </div>
        {/* readout under the track */}
        <div className="mt-1.5 flex items-center justify-between text-xs">
          <span className="text-[var(--muted)] tabular-nums">
            est {fmtNum(r.record.current_estimated_1rm)} {r.record.estimated_1rm_unit}
          </span>
          {fresh ? (
            <span className="text-[var(--muted)]">freshly tested</span>
          ) : (
            <span className="font-medium tabular-nums text-[var(--success)]">
              +{fmtNum(r.gap)} · {pct.toFixed(0)}% ahead
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Chrome() {
  return (
    <div className="flex flex-col gap-2 border-b border-[var(--border)] px-6 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold tracking-tight">Personal Records</h1>
          <MockSwitcher />
        </div>
        <MockCustomize />
      </div>
      <p className="text-xs text-[var(--muted)]">
        How far your estimate has pulled ahead of each tested max — the lit gap is your cue.
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col divide-y divide-[var(--border)]">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="grid grid-cols-[180px_1fr] items-center gap-6 py-5">
          <div className="flex flex-col gap-2">
            <div className="h-3 w-28 animate-pulse rounded bg-[var(--surface-2)]" />
            <div className="h-5 w-20 animate-pulse rounded bg-[var(--surface-2)]" />
          </div>
          <div className="h-2.5 animate-pulse rounded-full bg-[var(--surface-2)]" />
        </div>
      ))}
    </div>
  );
}

function ErrorState() {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--danger)]">
      Couldn’t load your records. Retry?
    </div>
  );
}

// Shared mock chrome — the Lifts/Running switcher and Customize must stay
// present & obvious even after a variant recomposes the header.
export function MockSwitcher() {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] p-0.5 text-xs font-medium">
      <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-[var(--foreground)] ring-1 ring-[var(--accent)]">
        Lifts
      </span>
      <span className="rounded-full px-3 py-1 text-[var(--muted)]">Running</span>
    </div>
  );
}

export function MockCustomize() {
  return (
    <button className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-medium text-[var(--muted)] transition hover:text-[var(--foreground)]">
      Customize
    </button>
  );
}
