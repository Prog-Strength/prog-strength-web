"use client";

/**
 * VARIANT 4 / 5 — idiom: compact-dashboard
 * ----------------------------------------------------------------------------
 * The whole case at a glance. Trades celebration for OVERVIEW: every lift
 * visible at once in a tight tile grid, each tile a mini-stat — PR figure, a
 * small est-1RM delta, a readiness DOT that scales with the gap, and a tiny
 * trend spark. The deliberate density opposite of editorial-cards, and the
 * variant that scales best to 12 lifts.
 *
 *   Draws on : Whoop's overview grid + a trading dashboard — many cells, each
 *              one quantified glance, status encoded in color not chrome.
 *   Type scale: small, functional; figures stay tabular and tight.
 *   Color logic: status-encoded — the readiness dot scales warning by degree
 *              and goes calm/steel when fresh; spark is neutral-to-warm.
 *   Spacing  : very tight vertical rhythm, high information density.
 *
 * Throwaway DX mockup — static fixtures, no data wiring.
 */

import type { PersonalRecord } from "@/lib/api";
import {
  deriveReadiness,
  fmtAgo,
  fmtNum,
  sparkSeries,
  type Readiness,
  type RenderMode,
} from "../_fixtures";

export function CompactDashboard({
  records,
  mode,
}: {
  records: PersonalRecord[];
  mode: RenderMode;
}) {
  const tiles = records.map(deriveReadiness);
  // Lightweight summary strip — the "everything at a glance" frame.
  const due = tiles.filter((r) => r.ready).length;
  const tested = tiles.filter((r) => r.hasPR).length;

  return (
    <div className="flex flex-col">
      <Chrome due={due} tested={tested} total={tiles.length} />
      <div className="px-5 py-5">
        {mode === "error" ? (
          <ErrorState />
        ) : mode === "loading" ? (
          <LoadingState />
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {tiles.map((r) => (
              <Tile key={r.record.exercise_id} r={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Tile({ r }: { r: Readiness }) {
  if (!r.hasPR) {
    return (
      <div className="flex flex-col gap-1 rounded-lg border border-dashed border-[var(--border)] bg-transparent px-3 py-2.5">
        <p className="truncate text-[11px] text-[var(--muted)]" title={r.record.exercise_name}>
          {r.record.exercise_name}
        </p>
        <p className="text-lg font-semibold tabular-nums text-[var(--faint)]">—</p>
        <p className="text-[10px] text-[var(--faint)]">untested</p>
      </div>
    );
  }

  const pct = r.gapPct ?? 0;
  const intensity = Math.min(1, pct / 30);
  const fresh = pct < 5;
  const dotColor = fresh
    ? "var(--discipline-lift-dot)"
    : `color-mix(in srgb, var(--warning) ${40 + intensity * 60}%, var(--surface-3))`;

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
      <div className="flex items-center justify-between gap-1">
        <p className="truncate text-[11px] text-[var(--muted)]" title={r.record.exercise_name}>
          {r.record.exercise_name}
        </p>
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: dotColor }}
          title={fresh ? "freshly tested" : `${pct.toFixed(0)}% ahead`}
        />
      </div>

      <div className="flex items-baseline gap-1">
        <span className="text-xl font-semibold tabular-nums tracking-tight">
          {fmtNum(r.record.weight)}
        </span>
        <span className="text-[10px] text-[var(--faint)] tabular-nums">
          {r.record.unit}×{r.record.reps}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[11px] font-medium tabular-nums"
          style={{ color: fresh ? "var(--muted)" : "var(--success)" }}
        >
          {fresh ? "·" : `+${fmtNum(r.gap)}`}
          <span className="ml-1 text-[var(--faint)]">
            est {fmtNum(r.record.current_estimated_1rm)}
          </span>
        </span>
        <Spark series={sparkSeries(r, 9)} warm={!fresh} />
      </div>
      <p className="text-[10px] text-[var(--faint)]">{fmtAgo(r.daysSince)}</p>
    </div>
  );
}

// Tiny inline trend spark. SVG path normalized into a fixed box.
function Spark({ series, warm }: { series: number[]; warm: boolean }) {
  const w = 40;
  const h = 14;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const pts = series
    .map((v, i) => {
      const x = (i / (series.length - 1)) * w;
      const y = h - ((v - min) / span) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0" aria-hidden="true">
      <polyline
        points={pts}
        fill="none"
        stroke={warm ? "var(--warning)" : "var(--discipline-lift-dot)"}
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
      />
    </svg>
  );
}

function Chrome({ due, tested, total }: { due: number; tested: number; total: number }) {
  return (
    <div className="flex flex-col gap-2 border-b border-[var(--border)] px-5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold tracking-tight">Personal Records</h1>
          <div className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] p-0.5 text-[11px] font-medium">
            <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-0.5 text-[var(--foreground)] ring-1 ring-[var(--accent)]">
              Lifts
            </span>
            <span className="rounded-full px-2.5 py-0.5 text-[var(--muted)]">Running</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-[var(--muted)]">
          <span className="tabular-nums">
            <span className="font-semibold text-[var(--warning)]">{due}</span> due
          </span>
          <span className="tabular-nums">
            <span className="font-semibold text-[var(--foreground)]">{tested}</span>/{total} tested
          </span>
          <button className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-0.5 font-medium transition hover:text-[var(--foreground)]">
            Customize
          </button>
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5"
        >
          <div className="h-2.5 w-3/4 animate-pulse rounded bg-[var(--surface-2)]" />
          <div className="h-5 w-1/2 animate-pulse rounded bg-[var(--surface-2)]" />
          <div className="h-2.5 w-2/3 animate-pulse rounded bg-[var(--surface-2)]" />
        </div>
      ))}
    </div>
  );
}

function ErrorState() {
  return (
    <div className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--danger)]">
      Couldn’t load your records. Retry?
    </div>
  );
}
